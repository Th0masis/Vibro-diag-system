import { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function MachineGraphs({ machineId }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Stav pro vybranou metriku (výchozí RMS)
  const [metric, setMetric] = useState('rms');

  // Definice metrik a jejich barev/popisů
  const metrics = {
    rms: { label: 'RMS Rychlost (mm/s)', color: '#ff8200' }, // B&R Orange
    peak: { label: 'Peak Rychlost (mm/s)', color: '#3b82f6' }, // Modrá
    iso: { label: 'ISO 10816', color: '#E60005' }           // VUT Red
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Stáhneme např. posledních 100 měření, ať je graf plný
        const res = await axios.get(`http://127.0.0.1:8000/machines/${machineId}/measurements?limit=100`);
        
        // API vrací data od NEJNOVĚJŠÍHO (DESC).
        // Pro graf je potřebujeme od NEJSTARŠÍHO (zleva doprava).
        // Proto použijeme .reverse()
        const chartData = res.data.reverse().map(item => ({
          ...item,
          // Formátování času pro osu X (jen hodiny:minuty)
          formattedTime: new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          // Formátování celého data pro Tooltip
          fullDate: new Date(item.time).toLocaleString() 
        }));
        
        setData(chartData);
      } catch (error) {
        console.error("Chyba načítání grafů:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [machineId]);

  // Vlastní Tooltip (bublina při najetí myší)
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: 'white', border: '1px solid #ccc', padding: '10px', borderRadius: '4px' }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>{payload[0].payload.fullDate}</p>
          <p style={{ margin: 0, color: payload[0].color }}>
            {metrics[metric].label}: {payload[0].value.toFixed(3)}
          </p>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#666' }}>
            {payload[0].payload.sensor} ({payload[0].payload.position})
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ height: '100%' }}>
      {/* 1. OVLÁDACÍ PANEL - PŘEPÍNÁNÍ METRIK */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <span style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>Zobrazit:</span>
        {Object.keys(metrics).map((key) => (
          <button
            key={key}
            onClick={() => setMetric(key)}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: `2px solid ${metrics[key].color}`,
              background: metric === key ? metrics[key].color : 'transparent',
              color: metric === key ? 'white' : metrics[key].color,
              cursor: 'pointer',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
          >
            {key.toUpperCase()}
          </button>
        ))}
      </div>

      {/* 2. GRAF */}
      <div style={{ width: '100%', height: 400, background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        {loading ? <p>Načítám graf...</p> : (
          data.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
              Zatím nejsou k dispozici žádná data pro graf.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                    dataKey="formattedTime" 
                    stroke="#64748b" 
                    fontSize={12}
                    tick={{dy: 10}}
                />
                <YAxis 
                    stroke="#64748b" 
                    fontSize={12}
                    label={{ value: metrics[metric].label, angle: -90, position: 'insideLeft', style: {textAnchor: 'middle', fill: '#94a3b8'} }} 
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line 
                    type="monotone" 
                    dataKey={metric} 
                    stroke={metrics[metric].color} 
                    strokeWidth={3} 
                    dot={false} 
                    activeDot={{ r: 8 }} 
                    name={metrics[metric].label}
                    animationDuration={500}
                />
              </LineChart>
            </ResponsiveContainer>
          )
        )}
      </div>
      
      <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#94a3b8', marginTop: '10px' }}>
        Zobrazuji posledních {data.length} měření. Pro generování nových dat přejděte na záložku Historie.
      </p>
    </div>
  );
}

export default MachineGraphs;