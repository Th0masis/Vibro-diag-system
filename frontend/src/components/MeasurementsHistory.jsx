import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import MeasurementDetailModal from './MeasurementDetailModal'; 

function MeasurementsHistory({ machineId }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Stavy pro UI logiku
  const [limit, setLimit] = useState(20);
  const [selectedIds, setSelectedIds] = useState([]);
  const [processingId, setProcessingId] = useState(null);
  
  // Progress Bar stavy
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalToProcess, setTotalToProcess] = useState(0);

  // --- FILTRY ---
  const [filterStatus, setFilterStatus] = useState('all'); 
  const [filterSensor, setFilterSensor] = useState('all');
  const [filterDate, setFilterDate] = useState(''); 
  const [filterTime, setFilterTime] = useState(''); // NOVÉ: State pro čas

  // Modal
  const [selectedMeasurementId, setSelectedMeasurementId] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/machines/${machineId}/history`);
      setData(res.data);
    } catch (error) {
      console.error("Chyba:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [machineId]);

  const filteredData = useMemo(() => {
    return data.filter(row => {
      // 1. Filtr Statusu
      if (filterStatus === 'processed' && !row.processed) return false;
      if (filterStatus === 'unprocessed' && row.processed) return false;
      
      // 2. Filtr Senzoru
      if (filterSensor !== 'all' && row.sensor_name !== filterSensor) return false;

      // Převedeme timestamp na Date objekt (tím získáme správný lokální čas prohlížeče)
      const rowDate = new Date(row.timestamp);
      
      // Pokud je datum neplatné, raději ho nevyřazujeme (nebo vyřazujeme, dle preference)
      if (isNaN(rowDate)) return false;

      // 3. Filtr DATA (YYYY-MM-DD)
      if (filterDate) {
        // filterDate je string "2024-01-29"
        // Musíme porovnat rok, měsíc a den lokálního času
        const targetDate = new Date(filterDate);
        
        const isSameDay = 
          rowDate.getFullYear() === targetDate.getFullYear() &&
          rowDate.getMonth() === targetDate.getMonth() &&
          rowDate.getDate() === targetDate.getDate();
          
        if (!isSameDay) return false;
      }

      // 4. Filtr ČASU (HH:mm)
      if (filterTime) {
        // filterTime je string "12:35"
        const [targetH, targetM] = filterTime.split(':').map(Number);
        
        const rowH = rowDate.getHours();   // Lokální hodina
        const rowM = rowDate.getMinutes(); // Lokální minuta
        
        // Porovnáme přesně hodinu a minutu
        if (rowH !== targetH || rowM !== targetM) return false;
      }
      
      return true;
    });
  }, [data, filterStatus, filterSensor, filterDate, filterTime]);
  
  const visibleData = filteredData.slice(0, limit);
  const uniqueSensors = [...new Set(data.map(d => d.sensor_name))];

  // --- HANDLERS ---
  const handleBatchAnalyze = async () => {
    if (selectedIds.length === 0) return;
    setIsBatchProcessing(true);
    setTotalToProcess(selectedIds.length);
    setProcessedCount(0);
    for (const id of selectedIds) {
      try {
        await axios.post(`http://127.0.0.1:8000/measurements/${id}/process`);
      } catch (e) { console.error(e); } finally { setProcessedCount(p => p + 1); }
    }
    await new Promise(r => setTimeout(r, 500));
    alert(`Dokončeno! Zpracováno ${selectedIds.length} záznamů.`);
    setIsBatchProcessing(false);
    setSelectedIds([]); 
    fetchData(); 
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const idsToSelect = visibleData.filter(row => !row.processed).map(row => row.id_measurement);
      setSelectedIds(idsToSelect);
    } else { setSelectedIds([]); }
  };

  const handleRowSelect = (id) => {
    selectedIds.includes(id) 
      ? setSelectedIds(selectedIds.filter(sid => sid !== id)) 
      : setSelectedIds([...selectedIds, id]);
  };

  const handleExtractFeatures = async (id) => {
    setProcessingId(id);
    try {
      await axios.post(`http://127.0.0.1:8000/measurements/${id}/process`);
      fetchData();
    } catch { alert("Chyba"); } finally { setProcessingId(null); }
  };

  const progressPercentage = totalToProcess > 0 ? (processedCount / totalToProcess) * 100 : 0;

  return (
    <div>
      <div className="history-header-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <h3 style={{ margin: 0, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ width: '4px', height: '20px', background: '#E4002B', display: 'block', borderRadius: '2px' }}></span>
              Historie měření
              <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 'normal' }}>({filteredData.length} záznamů)</span>
            </h3>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {/* STATUS FILTER */}
              <select 
                className="custom-select"
                value={filterStatus} 
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">Všechny stavy</option>
                <option value="processed">✅ Zpracované</option>
                <option value="unprocessed">⏳ Nezpracované</option>
              </select>

              {/* SENSOR FILTER */}
              <select 
                className="custom-select"
                value={filterSensor} 
                onChange={(e) => setFilterSensor(e.target.value)}
              >
                <option value="all">Všechny senzory</option>
                {uniqueSensors.map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              {/* SKUPINA PRO DATUM A ČAS */}
              <div style={{ display: 'flex', gap: '5px' }}>
                
                {/* DATE FILTER */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input 
                    type="date" 
                    className="custom-select"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    style={{ paddingRight: filterDate ? '30px' : '15px' }}
                  />
                  {filterDate && (
                    <button 
                      onClick={() => setFilterDate('')}
                      style={{ 
                        position: 'absolute', right: '5px', background: 'transparent', 
                        border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.2rem', lineHeight: '1' 
                      }}
                      title="Zrušit filtr data"
                    >
                      &times;
                    </button>
                  )}
                </div>

                {/* NOVÉ: TIME FILTER */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input 
                    type="time" 
                    className="custom-select"
                    value={filterTime}
                    onChange={(e) => setFilterTime(e.target.value)}
                    style={{ paddingRight: filterTime ? '30px' : '15px' }}
                  />
                  {filterTime && (
                    <button 
                      onClick={() => setFilterTime('')}
                      style={{ 
                        position: 'absolute', right: '5px', background: 'transparent', 
                        border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.2rem', lineHeight: '1' 
                      }}
                      title="Zrušit filtr času"
                    >
                      &times;
                    </button>
                  )}
                </div>
              </div>

            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
             {selectedIds.length > 0 ? (
                <div className="selection-badge">
                  <span>Vybráno: {selectedIds.length}</span>
                  <button 
                    className="btn-diagnose" 
                    onClick={handleBatchAnalyze}
                    disabled={isBatchProcessing}
                    style={{ padding: '6px 16px', fontSize: '0.9rem', background: isBatchProcessing ? '#94a3b8' : '#E4002B' }}
                  >
                    {isBatchProcessing ? 'Analyzuji...' : '⚡ Spustit analýzu'}
                  </button>
                </div>
             ) : (
               <div style={{ height: '36px' }}></div> 
             )}
          </div>
        </div>

        {isBatchProcessing && (
          <div style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '5px', color: '#64748b' }}>
              <span>Zpracovávám data...</span>
              <span>{Math.round(progressPercentage)}% ({processedCount}/{totalToProcess})</span>
            </div>
            <div className="progress-container">
              <div className="progress-fill" style={{ width: `${progressPercentage}%` }}></div>
            </div>
          </div>
        )}
      </div>

      <div className="table-wrapper">
        {loading ? <p style={{padding: '20px'}}>Načítám data...</p> : (
          <table>
            <thead>
              <tr>
                <th style={{ width: '50px', textAlign: 'center' }}>
                  <input 
                    type="checkbox" 
                    className="custom-checkbox"
                    onChange={handleSelectAll} 
                    disabled={isBatchProcessing} 
                    checked={visibleData.length > 0 && selectedIds.length > 0 && visibleData.filter(r => !r.processed).every(r => selectedIds.includes(r.id_measurement))}
                  />
                </th>
                <th>Čas měření</th>
                <th>Senzor</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Akce</th>
              </tr>
            </thead>
            <tbody>
              {visibleData.map((row) => (
                <tr key={row.id_measurement} style={{ background: selectedIds.includes(row.id_measurement) ? '#fff1f2' : 'transparent', transition: '0.2s' }}>
                  <td style={{ textAlign: 'center' }}>
                    {!row.processed && (
                      <input 
                        type="checkbox" 
                        className="custom-checkbox"
                        style={{ margin: '0 auto' }}
                        checked={selectedIds.includes(row.id_measurement)} 
                        onChange={() => handleRowSelect(row.id_measurement)}
                        disabled={isBatchProcessing}
                      />
                    )}
                  </td>
                  <td style={{ color: '#475569', fontSize: '0.9rem', fontWeight: '500' }}>
                    {new Date(row.timestamp).toLocaleString('cs-CZ')}
                  </td>
                  <td><span className="badge-sensor">{row.sensor_name}</span></td>
                  <td>
                    {row.processed ? (
                      <span className="status-badge processed">Zpracováno</span>
                    ) : (
                      <span className="status-badge unprocessed">Čeká na analýzu</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      {!row.processed && (
                        <button 
                          className="btn-action-small"
                          onClick={() => handleExtractFeatures(row.id_measurement)}
                          disabled={processingId === row.id_measurement || isBatchProcessing}
                        >
                          {processingId === row.id_measurement ? '...' : '⚙️'}
                        </button>
                      )}
                      <button 
                        className="btn-action-small"
                        style={{ background: '#3b82f6', color: 'white' }}
                        onClick={() => setSelectedMeasurementId(row.id_measurement)}
                      >
                        🔍
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {filteredData.length > limit && (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <button 
              className="btn-cancel" 
              onClick={() => setLimit(limit + 20)}
              style={{ width: '200px', borderColor: '#cbd5e1' }}
            >
              Načíst další...
            </button>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '10px' }}>
              Zobrazeno {limit} z {filteredData.length} záznamů
            </p>
          </div>
        )}
      </div>

      {selectedMeasurementId && (
        <MeasurementDetailModal 
          measurementId={selectedMeasurementId} 
          onClose={() => setSelectedMeasurementId(null)} 
          onProcessed={fetchData}
        />
      )}
    </div>
  );
}

export default MeasurementsHistory;