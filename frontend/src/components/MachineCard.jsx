import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

function MachineCard({ machine }) {
  const navigate = useNavigate();
  const [graphData, setGraphData] = useState([]);
  const [sensors, setSensors] = useState([]); // Seznam nalezených senzorů pro vykreslení čar
  
  // Barvy podle statusu
  const statusColor = machine.status === 'OK' ? '#22c55e' : machine.status === 'WARNING' ? '#ff8200' : '#E4002B';
  const statusBg = machine.status === 'OK' ? '#dcfce7' : machine.status === 'WARNING' ? '#ffedd5' : '#fee2e2';
  const statusText = machine.status === 'OK' ? '#166534' : machine.status === 'WARNING' ? '#9a3412' : '#991b1b';

  // Paleta barev pro čáry v grafu (aby se odlišily senzory)
  // První barva je "hlavní" (např. tmavě šedá), druhá je doplňková (modrá)
  const lineColors = ['#334155', '#3b82f6', '#E4002B', '#ff8200'];

  // Načtení a zpracování dat pro Sparkline graf
  useEffect(() => {
    const fetchMiniGraph = async () => {
      try {
        // Stáhneme dostatek historie, abychom pokryli oba senzory
        const res = await axios.get(`http://127.0.0.1:8000/machines/${machine.id_machine}/history`);
        
        const raw = res.data.filter(d => d.processed);

        // 1. Seskupení podle času (Pivot)
        // Cíl: { time: 123456789, "SensorH": 0.5, "SensorV": 0.6 }
        const groupedMap = new Map();
        const foundSensors = new Set();

        raw.forEach(item => {
           const dateObj = new Date(item.timestamp);
           // Zaokrouhlíme na minuty, aby se senzory potkaly
           const timeKey = `${dateObj.getFullYear()}-${dateObj.getMonth()}-${dateObj.getDate()} ${dateObj.getHours()}:${dateObj.getMinutes()}`;
           
           if (!groupedMap.has(timeKey)) {
             groupedMap.set(timeKey, {
               originalTimestamp: dateObj.getTime(), // Pro řazení
               displayTime: dateObj.toLocaleDateString() // Pro tooltip
             });
           }
           
           const entry = groupedMap.get(timeKey);
           entry[item.sensor_name] = item.rms; // Uložíme RMS pod jménem senzoru
           foundSensors.add(item.sensor_name);
        });

        // 2. Převod na pole a ŘAZENÍ (Nejstarší -> Nejnovější)
        let processedData = Array.from(groupedMap.values())
            .sort((a, b) => a.originalTimestamp - b.originalTimestamp);

        // 3. Vezmeme posledních X bodů (např. 30 časových bodů)
        // Protože jsme seřadili vzestupně, bereme konec pole
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

  return (
    <div className="detail-card" style={{ 
      borderTop: `4px solid ${statusColor}`, 
      padding: '15px', 
      display: 'flex', 
      flexDirection: 'column',
      height: '100%' 
    }}>
      
      {/* 1. HLAVIČKA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#1e293b' }}>{machine.name}</h3>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{machine.type}</span>
        </div>
        <span style={{ 
          background: statusBg, color: statusText, 
          padding: '2px 8px', borderRadius: '6px', 
          fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase' 
        }}>
          {machine.status}
        </span>
      </div>

      {/* 2. OBSAH (Grid 2:1) */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '15px', flex: 1 }}>
        
        {/* --- LEVÝ SLOUPEC (Graf + Poznámka) --- */}
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
                   {/* Dynamicky vykreslíme čáru pro každý nalezený senzor */}
                   {sensors.map((sensorName, index) => (
                     <Line 
                        key={sensorName}
                        type="monotone" 
                        dataKey={sensorName} 
                        stroke={lineColors[index % lineColors.length]} 
                        strokeWidth={2} 
                        dot={false} 
                        connectNulls={true} // Spojí čáru i když data nejdou přesně po sobě
                     />
                   ))}
                 </LineChart>
               </ResponsiveContainer>
             ) : (
               <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: '#cbd5e1' }}>Bez dat</div>
             )}
          </div>

          {/* Poslední poznámka */}
          <div style={{ 
            background: '#f8fafc', 
            borderRadius: '6px', 
            padding: '8px', 
            fontSize: '0.75rem', 
            color: '#475569',
            flex: 1, 
            borderLeft: `2px solid ${machine.last_note ? '#cbd5e1' : 'transparent'}`
          }}>
            <div style={{ fontWeight: '600', marginBottom: '2px', fontSize: '0.7rem', color: '#94a3b8' }}>
               Poslední servis: {machine.last_note_time ? new Date(machine.last_note_time).toLocaleDateString() : '-'}
            </div>
            <div style={{ 
               display: '-webkit-box', WebkitLineClamp: '3', WebkitBoxOrient: 'vertical', overflow: 'hidden',
               fontStyle: machine.last_note ? 'normal' : 'italic'
            }}>
              {machine.last_note || "Žádné záznamy."}
            </div>
          </div>

        </div>

        {/* --- PRAVÝ SLOUPEC (Tlačítka) --- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <CompactBtn label="Detail" icon="🔍" onClick={() => goToDetail('info')} />
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

// Pomocná komponenta pro tlačítka
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