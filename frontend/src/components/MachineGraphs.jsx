import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import MeasurementDetailModal from './MeasurementDetailModal'; // 1. Import Modalu

function MachineGraphs({ machineId }) {
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- STAVY ---
  const [metric, setMetric] = useState('rms'); 
  const [selectedSensor, setSelectedSensor] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  // 2. Stav pro otevření modalu
  const [selectedMeasurementId, setSelectedMeasurementId] = useState(null);

  const metricsInfo = {
    rms: { label: 'RMS (g)', color: '#ff8200' },
    peak: { label: 'Peak (g)', color: '#3b82f6' },
    kurtosis: { label: 'Kurtosis (-)', color: '#8b5cf6' },
    crest_factor: { label: 'Crest Factor (-)', color: '#10b981' },
    envelope: { label: 'Obálka signálu (Min-Max)', color: '#E60005' }
  };

  const sensorColors = ['#ff8200', '#3b82f6', '#E60005', '#10b981', '#8b5cf6'];

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`http://127.0.0.1:8000/machines/${machineId}/history`);
        setRawData(res.data);
      } catch (error) {
        console.error("Chyba načítání grafů:", error);
      } finally {
        setLoading(false);
      }
    };
    if (machineId) fetchData();
  }, [machineId]);

  // --- PŘÍPRAVA DAT ---
  const chartData = useMemo(() => {
    let filtered = rawData.filter(item => item.processed);
    
    if (dateFrom) filtered = filtered.filter(item => item.timestamp >= dateFrom);
    if (dateTo) filtered = filtered.filter(item => item.timestamp <= dateTo + 'T23:59:59');
    if (selectedSensor !== 'all') filtered = filtered.filter(item => item.sensor_name === selectedSensor);

    const groupedMap = new Map();

    filtered.forEach(item => {
      const dateObj = new Date(item.timestamp);
      // Klíč: zaokrouhleno na minuty
      const timeKey = `${dateObj.getFullYear()}-${dateObj.getMonth()+1}-${dateObj.getDate()} ${dateObj.getHours()}:${dateObj.getMinutes()}`;
      
      if (!groupedMap.has(timeKey)) {
        groupedMap.set(timeKey, {
          originalTimestamp: dateObj.getTime(),
          displayTime: dateObj.toLocaleString('cs-CZ')
        });
      }

      const entry = groupedMap.get(timeKey);
      
      // LOGIKA HODNOT A ID
      if (metric === 'envelope') {
        if (item.min_val !== null && item.max_val !== null) {
          entry[item.sensor_name] = [item.min_val, item.max_val];
        }
      } else {
        entry[item.sensor_name] = item[metric]; 
      }
      
      // 3. DŮLEŽITÉ: Uložíme si ID měření pro tento senzor
      // Klíč bude např. "PCB_352C33_H_id"
      entry[`${item.sensor_name}_id`] = item.id_measurement;
    });

    return Array.from(groupedMap.values()).sort((a, b) => a.originalTimestamp - b.originalTimestamp);

  }, [rawData, metric, selectedSensor, dateFrom, dateTo]);

  const uniqueSensors = useMemo(() => {
    const sensors = new Set(rawData.map(r => r.sensor_name));
    return Array.from(sensors);
  }, [rawData]);

  const ChartComponent = metric === 'envelope' ? AreaChart : LineChart;
  const DataComponent = metric === 'envelope' ? Area : Line;

  return (
    <div style={{ height: '100%' }}>
      
      {/* OVLÁDACÍ PANEL */}
      <div className="history-header-card" style={{ padding: '15px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {Object.keys(metricsInfo).map((key) => (
              <button
                key={key}
                onClick={() => setMetric(key)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '20px',
                  border: `1px solid ${metricsInfo[key].color}`,
                  background: metric === key ? metricsInfo[key].color : 'white',
                  color: metric === key ? 'white' : metricsInfo[key].color,
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  transition: 'all 0.2s',
                  boxShadow: metric === key ? '0 2px 5px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                {metricsInfo[key].label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select 
              className="custom-select"
              value={selectedSensor}
              onChange={(e) => setSelectedSensor(e.target.value)}
            >
              <option value="all">Všechny senzory</option>
              {uniqueSensors.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <span style={{color: '#cbd5e1'}}>|</span>

            <input type="date" className="custom-select" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <span style={{color: '#64748b'}}>-</span>
            <input type="date" className="custom-select" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            
            {(dateFrom || dateTo) && (
              <button 
                onClick={() => { setDateFrom(''); setDateTo(''); }}
                style={{ background: 'none', border: 'none', color: '#E60005', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 'bold' }}
              >
                &times;
              </button>
            )}
          </div>
        </div>
      </div>

      {/* PLÁTNO GRAFU */}
      <div style={{ width: '100%', height: 450, background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        {loading ? <p>Načítám data...</p> : (
          chartData.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
              <p>Žádná data pro zobrazení.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ChartComponent data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                
                <XAxis 
                  dataKey="originalTimestamp" 
                  type="number"
                  domain={['auto', 'auto']}
                  tickFormatter={(unixTime) => new Date(unixTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  stroke="#94a3b8" 
                  fontSize={12}
                />
                
                <YAxis 
                  stroke="#94a3b8" fontSize={12}
                  label={{ value: metricsInfo[metric].label, angle: -90, position: 'insideLeft', style: { fill: '#64748b' } }} 
                  domain={metric === 'envelope' ? ['dataMin', 'dataMax'] : ['auto', 'auto']}
                />
                
                <Tooltip 
                  labelFormatter={(unixTime) => new Date(unixTime).toLocaleString()}
                  formatter={(value, name) => {
                      if (Array.isArray(value)) return [`Min: ${value[0].toFixed(3)}, Max: ${value[1].toFixed(3)}`, name];
                      return [Number(value).toFixed(4), name];
                  }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                
                <Legend verticalAlign="top" height={36}/>
                
                {/* Generování čar */}
                {(selectedSensor === 'all' ? uniqueSensors : [selectedSensor]).map((sensorName, index) => {
                  const color = sensorColors[index % sensorColors.length];
                  return (
                    <DataComponent 
                      key={sensorName}
                      type="monotone" 
                      dataKey={sensorName} 
                      name={sensorName}
                      stroke={color}
                      fill={color}
                      fillOpacity={metric === 'envelope' ? 0.3 : 0}
                      strokeWidth={2} 
                      dot={false}
                      connectNulls={true}
                      animationDuration={800}

                      // 4. INTERAKTIVITA - Kliknutí na bod
                      activeDot={{ 
                        r: 7, 
                        cursor: 'pointer',
                        strokeWidth: 2,
                        stroke: 'white',
                        onClick: (e, payload) => {
                          // Payload obsahuje data daného bodu na ose X.
                          // Potřebujeme vytáhnout ID specifické pro tento senzor.
                          const measId = payload.payload[`${sensorName}_id`];
                          if (measId) {
                            setSelectedMeasurementId(measId);
                          } else {
                            console.log("ID měření nenalezeno pro tento bod/senzor");
                          }
                        }
                      }}
                    />
                  );
                })}
              </ChartComponent>
            </ResponsiveContainer>
          )
        )}
      </div>

      <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#94a3b8', marginTop: '10px' }}>
        <strong>Tip:</strong> Kliknutím na bod v grafu zobrazíte detailní analýzu.
      </p>

      {/* 5. Vykreslení Modalu */}
      {selectedMeasurementId && (
        <MeasurementDetailModal 
          measurementId={selectedMeasurementId} 
          onClose={() => setSelectedMeasurementId(null)} 
          // onProcessed={fetchData} // Volitelné, pokud by se v modalu něco měnilo
        />
      )}
    </div>
  );
}

export default MachineGraphs;