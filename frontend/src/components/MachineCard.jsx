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
  const statusColor = machineStatus === 'OK' ? '#22c55e' : machineStatus === 'WARNING' ? '#ff8200' : '#B83030';
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

  return (
    <div className="detail-card" style={{ 
      borderTop: `4px solid ${statusColor}`, 
      padding: '15px', 
      display: 'flex', 
      flexDirection: 'column',
      height: '100%' 
    }}>
      
      {/* 1. HLAVIČKA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '5px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#1e293b' }} className="truncate">{machine.name}</h3>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }} className="truncate">{machine.type}</span>
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
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '15px', flex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          
          {/* Mini Graf */}
          <div style={{ height: '90px', position: 'relative', border: '1px solid #f1f5f9', borderRadius: '6px', padding: '5px' }}>
             <span style={{ position: 'absolute', top: 2, left: 4, fontSize: '0.65rem', color: '#94a3b8', zIndex: 10 }}>RMS Trend</span>
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
               <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: '#cbd5e1' }}>Bez dat</div>
             )}
          </div>

          <div style={{ background: '#f8fafc', borderRadius: '6px', padding: '8px', fontSize: '0.75rem', color: '#475569', flex: 1, borderLeft: `2px solid ${machine.last_note ? '#cbd5e1' : 'transparent'}` }}>
            <div style={{ fontWeight: '600', marginBottom: '2px', fontSize: '0.7rem', color: '#94a3b8' }}>
               Poslední servis: {machine.last_note_time ? new Date(machine.last_note_time).toLocaleDateString() : '-'}
            </div>
            <div style={{ display: '-webkit-box', WebkitLineClamp: '3', WebkitBoxOrient: 'vertical', overflow: 'hidden', fontStyle: machine.last_note ? 'normal' : 'italic' }}>
              {machine.last_note || "Žádné záznamy."}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <CompactBtn label="Detail" icon="🔍" onClick={() => goToDetail('history')} />
          <CompactBtn label="Grafy" icon="📈" onClick={() => goToDetail('graphs')} />
          <CompactBtn label="Historie" icon="📅" onClick={() => goToDetail('history')} />
          <CompactBtn label="Senzory" icon="📡" onClick={() => goToDetail('sensors')} />
          <div style={{ flex: 1 }}></div> 
          <CompactBtn label="AI Diag." icon="🚀" primary onClick={() => goToDetail('diagnostics')} />
        </div>
      </div>

    </div>
  );
}

const CompactBtn = ({ label, icon, onClick, primary }) => (
  <button 
    onClick={onClick}
    style={{
      border: primary ? 'none' : '1px solid #e2e8f0',
      background: primary ? '#E4002B' : 'white',
      color: primary ? 'white' : '#475569',
      borderRadius: '4px',
      padding: '6px 4px',
      fontSize: '0.75rem',
      fontWeight: '600',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '6px',
      transition: '0.2s',
      width: '100%'
    }}
    onMouseEnter={(e) => e.currentTarget.style.background = primary ? '#b91c1c' : '#f1f5f9'}
    onMouseLeave={(e) => e.currentTarget.style.background = primary ? '#E4002B' : 'white'}
    title={label}
  >
    <span>{icon}</span> {label}
  </button>
);

export default MachineCard;