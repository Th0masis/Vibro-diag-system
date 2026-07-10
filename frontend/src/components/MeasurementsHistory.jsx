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
  const [filterSource, setFilterSource] = useState('all');
  const [filterDate, setFilterDate] = useState(''); 
  const [filterTime, setFilterTime] = useState('');

  // Modal
  const [selectedMeasurementId, setSelectedMeasurementId] = useState(initialSelectedMeasurementId);

  const getAuthHeader = () => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/machines/${machineId}/history`, getAuthHeader());
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
    const filtered = data.filter(item => {
      const isProcessed = item.rms != null;
      if (filterStatus === 'processed' && !isProcessed) return false;
      if (filterStatus === 'waiting' && isProcessed) return false;
      if (filterSensor !== 'all' && item.sensor_name !== filterSensor) return false;
      if (filterSource !== 'all' && item.source !== filterSource) return false;
      if (filterDate && !item.timestamp.startsWith(filterDate)) return false;
      if (filterTime) {
        const itemTime = new Date(item.timestamp).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
        if (itemTime !== filterTime) return false;
      }
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      if (filterSource === 'all' && a.source !== b.source) {
        return a.source === 'raw_analysis' ? -1 : 1;
      }
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

    return sorted;
  }, [data, filterStatus, filterSensor, filterSource, filterDate, filterTime]);

  // --- LOGIKA PRO CHECKBOXY ---
  const processableData = useMemo(() => {
    return filteredData.slice(0, limit).filter(d => d.source === 'raw_analysis' && d.rms == null);
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
      await axios.post(`/measurements/${id}/process`, {}, getAuthHeader());
      await fetchData(); 
    } catch (error) {
      alert('Processing failed: ' + error.message);
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
        await axios.post(`/measurements/${id}/process`, {}, getAuthHeader());
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
        <div className="history-inline-detail">
          <MeasurementDetailModal
            measurementId={selectedMeasurementId}
            onClose={() => setSelectedMeasurementId(null)}
            onProcessed={fetchData}
            inline
          />
        </div>
      )}

      {/* TOOLBAR S FILTRY - S flex layoutem */}
      <div className="history-toolbar">
        
        <div className="history-filter-group">
          <label className="history-filter-label">Sensor:</label>
          <select className="history-filter-control" value={filterSensor} onChange={(e) => setFilterSensor(e.target.value)}>
            <option value="all">All sensors</option>
            {sensorList.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="history-filter-group">
          <label className="history-filter-label">Status:</label>
          <select className="history-filter-control" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All</option>
            <option value="processed">Processed</option>
            <option value="waiting">Awaiting analysis</option>
          </select>
        </div>

        <div className="history-filter-group">
          <label className="history-filter-label">Source:</label>
          <select className="history-filter-control" value={filterSource} onChange={(e) => setFilterSource(e.target.value)}>
            <option value="all">All (raw first)</option>
            <option value="raw_analysis">Raw recording</option>
            <option value="iiot_connector">IIoT Connector</option>
          </select>
        </div>

        <div className="history-filter-group">
          <label className="history-filter-label">Date:</label>
          <input className="history-filter-control" type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
        </div>

        <div className="history-toolbar-spacer"></div>

        <button 
          className={`btn-diagnose history-batch-button ${(isBatchProcessing || selectedIds.length === 0) ? 'history-batch-button--disabled' : ''}`}
          onClick={handleBatchProcess} 
          disabled={isBatchProcessing || selectedIds.length === 0}
        >
          {isBatchProcessing 
            ? `Processing (${processedCount}/${totalToProcess})…` 
            : `Process selected (${selectedIds.length})`
          }
        </button>
      </div>

      {/* TABULKA HISTORIE */}
      <div className="card-shadow history-table-card">
        {loading ? (
          <div className="history-loading-state">Loading history…</div>
        ) : (
          <table className="machine-table">
            <thead>
              <tr>
                <th className="history-select-head">
                  <input 
                    type="checkbox" 
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                    disabled={processableData.length === 0}
                    className={`history-checkbox ${processableData.length === 0 ? 'history-checkbox--disabled' : ''}`}
                    title="Select all for processing"
                  />
                </th>
                <th>Timestamp</th>
                <th>Sensor</th>
                <th>Data source</th>
                <th>RMS [g]</th>
                <th>Kurtosis</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.slice(0, limit).map((row) => {
                const canBeProcessed = row.source === 'raw_analysis' && row.rms == null;
                const rowKey = `${row.source}-${row.id_measurement}-${row.timestamp}`;
                
                return (
                <tr key={rowKey}>
                  <td className="history-select-cell">
                    {canBeProcessed ? (
                      <input 
                        type="checkbox"
                        checked={selectedIds.includes(row.id_measurement)}
                        onChange={() => handleSelect(row.id_measurement)}
                        className="history-checkbox"
                      />
                    ) : (
                      <span className="history-unavailable-marker">-</span>
                    )}
                  </td>
                  <td className="history-time-cell">
                    {new Date(row.timestamp).toLocaleString('cs-CZ', { 
                      day: '2-digit', month: '2-digit', year: 'numeric', 
                      hour: '2-digit', minute: '2-digit' 
                    })}
                  </td>
                  <td>
                    {row.sensor_name}
                    <br/>
                    <small className="history-sensor-position">{row.position}</small>
                  </td>
                  <td>
                    <span className={`badge history-source-badge ${row.source === 'iiot_connector' ? 'badge-blue' : 'badge-orange'}`}>
                      {row.source === 'iiot_connector' ? 'IIoT Connector' : 'Raw recording'}
                    </span>
                  </td>
                  <td className="history-rms-cell">
                    {row.rms != null ? row.rms.toFixed(4) : '-'}
                  </td>
                  <td>{row.kurtosis != null ? row.kurtosis.toFixed(2) : '-'}</td>
                  <td>
                    {row.rms != null ? (
                      <span className="history-status history-status--processed">Analyzed</span>
                    ) : (
                      <span className="history-status history-status--waiting">Awaiting analysis</span>
                    )}
                  </td>
                    <td className="text-right">
                      <div className="history-actions-wrap">
                        {/* Tlačítko pro zpracování (ozubené kolo) - jen pro nezpracovaná surová data */}
                        {row.source === 'raw_analysis' && row.rms == null && (
                          <button 
                            className="btn-action-small"
                            title="Run signal analysis"
                            onClick={() => handleSingleProcess(row.id_measurement)}
                            disabled={processingId === row.id_measurement || isBatchProcessing}
                          >
                            {processingId === row.id_measurement ? '…' : 'Analyze'}
                          </button>
                        )}
                        
                        {row.source === 'raw_analysis' && (
                          <button 
                            className="btn-action-small btn-action-primary"
                            title="View detail and graphs"
                            onClick={() => setSelectedMeasurementId(row.id_measurement)}
                          >
                            Detail
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
          <div className="history-empty-state">
            Žádné záznamy neodpovídají filtrům.
          </div>
        )}

        {filteredData.length > limit && (
          <div className="history-load-more-wrap">
            <button className="btn-load-more" onClick={() => setLimit(limit + 20)}>Load more</button>
          </div>
        )}
      </div>

    </div>
  );
}

export default MeasurementsHistory;