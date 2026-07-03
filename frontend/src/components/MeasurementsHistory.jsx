import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import MeasurementDetailModal from './MeasurementDetailModal'; 

function MeasurementsHistory({ machineId, initialSelectedMeasurementId = null }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Stavy pro UI logiku
  const [limit, setLimit] = useState(20);
  const [selectedIds, setSelectedIds] = useState([]); // Uchovává vybraná ID k hromadnému zpracování
  const [processingId, setProcessingId] = useState(null);
  
  // Progress Bar stavy
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalToProcess, setTotalToProcess] = useState(0);

  // --- FILTRY ---
  const [filterStatus, setFilterStatus] = useState('all'); 
  const [filterSensor, setFilterSensor] = useState('all');
  const [filterDate, setFilterDate] = useState(''); 
  const [filterTime, setFilterTime] = useState('');

  // Modal
  const [selectedMeasurementId, setSelectedMeasurementId] = useState(initialSelectedMeasurementId);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/machines/${machineId}/history`);
      setData(res.data);
      // Po načtení nových dat vyčistíme výběr
      setSelectedIds([]); 
    } catch (error) {
      console.error("Chyba při načítání historie:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (machineId) fetchData();
  }, [machineId]);

  useEffect(() => {
    setSelectedMeasurementId(initialSelectedMeasurementId);
  }, [initialSelectedMeasurementId]);

  const sensorList = useMemo(() => {
    const sensors = new Set(data.map(d => d.sensor_name));
    return Array.from(sensors).sort();
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const isProcessed = !!item.rms;
      if (filterStatus === 'processed' && !isProcessed) return false;
      if (filterStatus === 'waiting' && isProcessed) return false;
      if (filterSensor !== 'all' && item.sensor_name !== filterSensor) return false;
      if (filterDate && !item.timestamp.startsWith(filterDate)) return false;
      if (filterTime) {
        const itemTime = new Date(item.timestamp).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
        if (itemTime !== filterTime) return false;
      }
      return true;
    });
  }, [data, filterStatus, filterSensor, filterDate, filterTime]);

  // --- LOGIKA PRO CHECKBOXY ---
  const processableData = useMemo(() => {
    return filteredData.slice(0, limit).filter(d => d.source === 'raw_analysis' && !d.rms);
  }, [filteredData, limit]);

  const isAllSelected = processableData.length > 0 && processableData.every(d => selectedIds.includes(d.id_measurement));

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(processableData.map(d => d.id_measurement));
    }
  };

  const handleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(selectedId => selectedId !== id) : [...prev, id]
    );
  };

  // --- ZPRACOVÁNÍ ---
  const handleSingleProcess = async (id) => {
    setProcessingId(id);
    try {
      await axios.post(`/measurements/${id}/process`);
      await fetchData(); 
    } catch (error) {
      alert("Chyba při zpracování: " + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleBatchProcess = async () => {
    if (selectedIds.length === 0) return;

    setIsBatchProcessing(true);
    setTotalToProcess(selectedIds.length);
    setProcessedCount(0);

    // Zpracujeme pouze ta ID, která uživatel zaklikl
    for (const id of selectedIds) {
      try {
        await axios.post(`/measurements/${id}/process`);
        setProcessedCount(prev => prev + 1);
      } catch (e) {
        console.error(`Chyba u ID ${id}:`, e);
      }
    }

    setIsBatchProcessing(false);
    await fetchData(); // Fetch data zároveň vyčistí selectedIds
  };

  return (
    <div className="history-container">
      {selectedMeasurementId && (
        <div style={{ marginBottom: '16px' }}>
          <MeasurementDetailModal
            measurementId={selectedMeasurementId}
            onClose={() => setSelectedMeasurementId(null)}
            onProcessed={fetchData}
            inline
          />
        </div>
      )}

      {/* TOOLBAR S FILTRY - S flex layoutem */}
      <div style={{ 
        display: 'flex', gap: '20px', alignItems: 'flex-end', marginBottom: '20px', 
        flexWrap: 'wrap', background: 'white', padding: '15px 20px', 
        borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' 
      }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 'bold' }}>Senzor:</label>
          <select value={filterSensor} onChange={(e) => setFilterSensor(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', outline: 'none' }}>
            <option value="all">Všechny senzory</option>
            {sensorList.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 'bold' }}>Stav:</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', outline: 'none' }}>
            <option value="all">Všechny stavy</option>
            <option value="processed">✅ Zpracováno</option>
            <option value="waiting">⏳ Čeká na analýzu</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 'bold' }}>Datum:</label>
          <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', outline: 'none' }} />
        </div>

        <div style={{ flex: 1 }}></div>

        <button 
          className="btn-diagnose" 
          onClick={handleBatchProcess} 
          disabled={isBatchProcessing || selectedIds.length === 0}
          style={{ 
            padding: '10px 15px', height: 'fit-content',
            opacity: (isBatchProcessing || selectedIds.length === 0) ? 0.5 : 1,
            cursor: (isBatchProcessing || selectedIds.length === 0) ? 'not-allowed' : 'pointer'
          }}
        >
          {isBatchProcessing 
            ? `Zpracovávám (${processedCount}/${totalToProcess})` 
            : `⚙️ Zpracovat vybrané (${selectedIds.length})`
          }
        </button>
      </div>

      {/* TABULKA HISTORIE */}
      <div className="card-shadow" style={{ background: 'white', borderRadius: '8px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Načítám historii...</div>
        ) : (
          <table className="machine-table">
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>
                  <input 
                    type="checkbox" 
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                    disabled={processableData.length === 0}
                    style={{ cursor: processableData.length === 0 ? 'not-allowed' : 'pointer' }}
                    title="Vybrat všechny ke zpracování"
                  />
                </th>
                <th>Čas měření</th>
                <th>Senzor</th>
                <th>Zdroj dat</th>
                <th>RMS [g]</th>
                <th>Kurtosis</th>
                <th>Stav</th>
                <th className="text-right">Akce</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.slice(0, limit).map((row) => {
                const canBeProcessed = row.source === 'raw_analysis' && !row.rms;
                
                return (
                <tr key={row.timestamp + row.sensor_name + row.source}>
                  <td style={{ textAlign: 'center' }}>
                    {canBeProcessed ? (
                      <input 
                        type="checkbox"
                        checked={selectedIds.includes(row.id_measurement)}
                        onChange={() => handleSelect(row.id_measurement)}
                        style={{ cursor: 'pointer' }}
                      />
                    ) : (
                      <span style={{ color: '#cbd5e1' }}>-</span>
                    )}
                  </td>
                  <td style={{ fontWeight: '500' }}>
                    {new Date(row.timestamp).toLocaleString('cs-CZ', { 
                      day: '2-digit', month: '2-digit', year: 'numeric', 
                      hour: '2-digit', minute: '2-digit' 
                    })}
                  </td>
                  <td>{row.sensor_name} <br/> <small style={{color: '#94a3b8'}}>{row.position}</small></td>
                  <td>
                    <span className={`badge ${row.source === 'iiot_connector' ? 'badge-blue' : 'badge-orange'}`} style={{fontSize: '0.65rem'}}>
                      {row.source === 'iiot_connector' ? 'IIoT Connector' : 'Surový záznam'}
                    </span>
                  </td>
                  <td style={{ fontWeight: 'bold', color: '#1e293b' }}>
                    {row.rms ? row.rms.toFixed(4) : '-'}
                  </td>
                  <td>{row.kurtosis ? row.kurtosis.toFixed(2) : '-'}</td>
                  <td>
                    {row.rms ? (
                      <span style={{ color: '#22c55e', fontSize: '0.85rem' }}>✅ Analyzováno</span>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>⏳ Čeká na zpracování</span>
                    )}
                  </td>
                    <td className="text-right">
                      <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end' }}>
                        {/* Tlačítko pro zpracování (ozubené kolo) - jen pro nezpracovaná surová data */}
                        {row.source === 'raw_analysis' && !row.rms && (
                          <button 
                            className="btn-action-small"
                            title="Spustit analýzu signálu"
                            onClick={() => handleSingleProcess(row.id_measurement)}
                            disabled={processingId === row.id_measurement || isBatchProcessing}
                          >
                            {processingId === row.id_measurement ? '...' : '⚙️'}
                          </button>
                        )}
                        
                        {/* Tlačítko pro detail (lupa) - ZOBRAZIT POUZE PRO raw_analysis */}
                        {row.source === 'raw_analysis' && (
                          <button 
                            className="btn-action-small"
                            style={{ background: '#3b82f6', color: 'white' }}
                            title="Zobrazit detail a grafy"
                            onClick={() => setSelectedMeasurementId(row.id_measurement)}
                          >
                            🔍
                          </button>
                        )}
                      </div>
                    </td>
                </tr>
              )})}
            </tbody>
          </table>
        )}

        {filteredData.length === 0 && !loading && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
            Žádné záznamy neodpovídají filtrům.
          </div>
        )}

        {filteredData.length > limit && (
          <div style={{ textAlign: 'center', padding: '20px', borderTop: '1px solid #f1f5f9' }}>
            <button className="btn-cancel" onClick={() => setLimit(limit + 20)}>Načíst další...</button>
          </div>
        )}
      </div>

    </div>
  );
}

export default MeasurementsHistory;