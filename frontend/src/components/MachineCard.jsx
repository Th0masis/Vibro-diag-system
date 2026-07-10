import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
// Importujeme nový pásek pro AI diagnostiku
import AiStatusBanner from './AiStatusBanner'; // Ujisti se, že cesta odpovídá umístění souboru

function MachineCard({ machine }) {
  const navigate = useNavigate();
  const [graphData, setGraphData] = useState([]);
  const [sensors, setSensors] = useState([]); 

  const machineStatus = (machine.status || '').toUpperCase();
  const statusClass = machineStatus === 'OK' ? 'ok' : machineStatus === 'WARNING' ? 'warning' : 'fault';
  const lineColors = ['#334155', '#3b82f6', '#E4002B', '#ff8200'];

  // Pomocná funkce pro získání autorizační hlavičky
  const getAuthHeader = () => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  };

  useEffect(() => {
    const fetchMiniGraph = async () => {
      try {
        // Přidán getAuthHeader() pro odeslání JWT tokenu
        const res = await axios.get(`/machines/${machine.id_machine}/history`, getAuthHeader());
        const raw = res.data.filter(d => d.rms != null);

        const groupedMap = new Map();
        const foundSensors = new Set();

        raw.forEach(item => {
           const dateObj = new Date(item.timestamp);
           const timeKey = `${dateObj.getFullYear()}-${dateObj.getMonth()}-${dateObj.getDate()} ${dateObj.getHours()}:${dateObj.getMinutes()}`;
           
           if (!groupedMap.has(timeKey)) {
             groupedMap.set(timeKey, {
               originalTimestamp: dateObj.getTime(),
               displayTime: dateObj.toLocaleDateString()
             });
           }
           
           const entry = groupedMap.get(timeKey);
           entry[item.sensor_name] = item.rms; 
           entry[`${item.sensor_name}_id`] = item.id_measurement; // ID pro proklik
           entry[`${item.sensor_name}_source`] = item.source; // Zdroj dat pro alert
           foundSensors.add(item.sensor_name);
        });

        let processedData = Array.from(groupedMap.values())
            .sort((a, b) => a.originalTimestamp - b.originalTimestamp);

        processedData = processedData.slice(-30);
        setSensors(Array.from(foundSensors));
        setGraphData(processedData);

      } catch (e) { console.error(e); }
    };
    fetchMiniGraph();
  }, [machine.id_machine]);

  const goToDetail = (tabName) => {
    navigate(`/machines/${machine.id_machine}`, { state: { tab: tabName } });
  };

  const goToMeasurementDetail = (measurementId) => {
    navigate(`/machines/${machine.id_machine}`, {
      state: { tab: 'history', selectedMeasurementId: measurementId }
    });
  };

  const machineCardStatusClass = `machine-card-pro--${statusClass}`;

  return (
    <div className={`detail-card machine-card-pro ${machineCardStatusClass}`}>
      
      {/* 1. HLAVIČKA */}
      <div className="machine-card-pro-header">
        <div className="machine-card-pro-title-wrap">
          <h3 className="machine-card-pro-title truncate">{machine.name}</h3>
          <div className="machine-card-pro-meta-row">
            <span className="machine-card-pro-type truncate">{machine.type}</span>
            <span className="machine-card-pro-meta-dot">•</span>
            <span className="machine-card-pro-meta-id">#{machine.id_machine}</span>
          </div>
        </div>
        <span 
          className={`status-badge status-${statusClass}`}
          role="status"
          aria-label={`Machine status: ${machineStatus}`}
        >
          <span aria-hidden="true">
            {machineStatus === 'OK' && '✓'}
            {machineStatus === 'WARNING' && '⚠'}
            {machineStatus !== 'OK' && machineStatus !== 'WARNING' && '🔴'}
          </span>
          {machineStatus}
        </span>
      </div>

      {/* 2. AI DIAGNOSTIKA - PÁSEK */}
      <AiStatusBanner machineId={machine.id_machine} />

      {/* 3. HLAVNÍ TĚLO KARTY */}
      <div className="machine-card-pro-body">
        <div className="machine-card-pro-main">
          
          {/* Mini Graf */}
          <div className="machine-card-pro-graph">
             <span className="machine-card-pro-graph-label">RMS Trend</span>
             {graphData.length > 0 ? (
               <ResponsiveContainer width="100%" height="100%">
                 <LineChart data={graphData}>
                   <YAxis domain={['auto', 'auto']} hide />
                   <Tooltip 
                      contentStyle={{ fontSize: '0.7rem', padding: '5px', border: 'none', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}
                      labelStyle={{ display: 'none' }}
                      formatter={(val, name) => [val.toFixed(3), name]}
                   />
                   {sensors.map((sensorName, index) => (
                     <Line 
                        key={sensorName}
                        type="monotone" 
                        dataKey={sensorName} 
                        stroke={lineColors[index % lineColors.length]} 
                        strokeWidth={2} 
                        dot={false} 
                        connectNulls={true}
                        activeDot={{ 
                          r: 5, 
                          cursor: 'pointer',
                          onClick: (e, payload) => {
                            const measId = payload.payload[`${sensorName}_id`];
                            const source = payload.payload[`${sensorName}_source`];
                            
                            if (measId) {
                              if (source === 'raw_analysis') {
                                goToMeasurementDetail(measId);
                              } else {
                                alert("Tento bod pochází z průběžného měření (IIoT Connector) a neobsahuje zdrojový soubor s vysokofrekvenčním záznamem pro detailní analýzu.");
                              }
                            }
                          }
                        }}
                     />
                   ))}
                 </LineChart>
               </ResponsiveContainer>
             ) : (
               <div className="machine-card-pro-empty">Bez dat</div>
             )}
          </div>

          <div className={`machine-card-pro-note ${machine.last_note ? 'machine-card-pro-note--filled' : ''}`}>
            <div className="machine-card-pro-note-meta">
              Service note{machine.last_note_time ? ` · ${new Date(machine.last_note_time).toLocaleDateString()}` : ''}
            </div>
            <div className={`truncate-multiline-3 ${machine.last_note ? '' : 'machine-card-pro-note-empty'}`}>
              {machine.last_note || "No entries yet."}
            </div>
          </div>
        </div>

        <div className="machine-card-pro-actions">
          <CompactBtn label="History" icon="history" onClick={() => goToDetail('history')} />
          <CompactBtn label="Trend" icon="trend" onClick={() => goToDetail('graphs')} />
          <CompactBtn label="AI Diag." icon="ai" primary onClick={() => goToDetail('diagnostics')} />
        </div>
      </div>

    </div>
  );
}

const ICONS = {
  history: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  trend: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
    </svg>
  ),
  ai: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
};

const CompactBtn = ({ label, icon, onClick, primary }) => (
  <button 
    className={`compact-btn-pro ${primary ? 'compact-btn-pro--primary' : ''}`}
    onClick={onClick}
    title={label}
  >
    {ICONS[icon]} {label}
  </button>
);

export default MachineCard;