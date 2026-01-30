import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

function MachineGraphs({ machineId }) {
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- STAVY FILTRŮ ---
  const [metric, setMetric] = useState('rms'); // defaultně RMS
  const [selectedSensor, setSelectedSensor] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Definice metrik a barev
  const metricsInfo = {
    rms: { label: 'RMS (g)', color: '#ff8200' },          // B&R Orange
    peak: { label: 'Peak (g)', color: '#3b82f6' },        // Blue
    kurtosis: { label: 'Kurtosis (-)', color: '#8b5cf6' }, // Purple
    crest_factor: { label: 'Crest Factor (-)', color: '#10b981' }, // Emerald
    envelope: { label: 'Obálka signálu (Min-Max)', color: '#E60005' } // VUT Red
  };

  // Paleta barev pro jednotlivé senzory (aby každý senzor měl jinou barvu v "all" pohledu)
  const sensorColors = ['#ff8200', '#3b82f6', '#E60005', '#10b981', '#8b5cf6'];

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Načítáme kompletní historii včetně min_val/max_val
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

  // --- PŘÍPRAVA DAT PRO RECHARTS ---
  const chartData = useMemo(() => {
    // 1. Filtrace
    let filtered = rawData.filter(item => item.processed); // Jen zpracovaná data
    
    // Filtr časového okna
    if (dateFrom) filtered = filtered.filter(item => item.timestamp >= dateFrom);
    if (dateTo) filtered = filtered.filter(item => item.timestamp <= dateTo + 'T23:59:59');
    
    // Filtr senzoru
    if (selectedSensor !== 'all') filtered = filtered.filter(item => item.sensor_name === selectedSensor);

    // 2. Pivotování (Seskupení podle času)
    const groupedMap = new Map();

    filtered.forEach(item => {
      const dateObj = new Date(item.timestamp);
      // Klíč zaokrouhlený na minuty (aby se senzory potkaly v jednom bodě)
      const timeKey = `${dateObj.getFullYear()}-${dateObj.getMonth()+1}-${dateObj.getDate()} ${dateObj.getHours()}:${dateObj.getMinutes()}`;
      
      if (!groupedMap.has(timeKey)) {
        groupedMap.set(timeKey, {
          originalTimestamp: dateObj.getTime(), // Pro osu X (číslo)
          displayTime: dateObj.toLocaleString('cs-CZ') // Pro tooltip
        });
      }

      const entry = groupedMap.get(timeKey);
      
      // LOGIKA PRO HODNOTY
      if (metric === 'envelope') {
        // Pro AreaChart potřebujeme pole [min, max]
        // Pozor: Pokud by backend vracel null, graf to ignoruje
        if (item.min_val !== null && item.max_val !== null) {
          entry[item.sensor_name] = [item.min_val, item.max_val];
        }
      } else {
        // Pro LineChart stačí jedna hodnota
        entry[item.sensor_name] = item[metric]; 
      }
    });

    // Převedeme Mapu na seřazené pole
    return Array.from(groupedMap.values()).sort((a, b) => a.originalTimestamp - b.originalTimestamp);

  }, [rawData, metric, selectedSensor, dateFrom, dateTo]);

  // Získání seznamu unikátních senzorů pro legendu
  const uniqueSensors = useMemo(() => {
    const sensors = new Set(rawData.map(r => r.sensor_name));
    return Array.from(sensors);
  }, [rawData]);

  // Dynamický výběr typu grafu
  const ChartComponent = metric === 'envelope' ? AreaChart : LineChart;
  const DataComponent = metric === 'envelope' ? Area : Line;

  return (
    <div style={{ height: '100%' }}>
      
      {/* --- OVLÁDACÍ PANEL --- */}
      <div className="history-header-card" style={{ padding: '15px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          
          {/* TLAČÍTKA METRIK */}
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

          {/* FILTRY (SENZOR + DATUM) */}
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

            <input 
              type="date" 
              className="custom-select"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              title="Datum od"
            />
            <span style={{color: '#64748b'}}>-</span>
            <input 
              type="date" 
              className="custom-select"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              title="Datum do"
            />
            
            {(dateFrom || dateTo) && (
              <button 
                onClick={() => { setDateFrom(''); setDateTo(''); }}
                style={{ background: 'none', border: 'none', color: '#E60005', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 'bold' }}
                title="Vymazat datum"
              >
                &times;
              </button>
            )}
          </div>
        </div>
      </div>

      {/* --- PLÁTNO GRAFU --- */}
      <div style={{ width: '100%', height: 450, background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        {loading ? <p>Načítám data...</p> : (
          chartData.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
              <p>Žádná data pro zobrazení.</p>
              <small>Zkontrolujte filtry nebo proveďte analýzu v Historii.</small>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ChartComponent data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                
                {/* Osa X: Čas */}
                <XAxis 
                  dataKey="originalTimestamp" 
                  type="number"
                  domain={['auto', 'auto']}
                  tickFormatter={(unixTime) => new Date(unixTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  stroke="#94a3b8" 
                  fontSize={12}
                />
                
                {/* Osa Y: Hodnoty */}
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={12}
                  label={{ value: metricsInfo[metric].label, angle: -90, position: 'insideLeft', style: { fill: '#64748b' } }} 
                  // Pro obálku chceme vidět i min hodnoty (včetně záporných)
                  domain={metric === 'envelope' ? ['dataMin', 'dataMax'] : ['auto', 'auto']}
                />
                
                {/* Tooltip */}
                <Tooltip 
                  labelFormatter={(unixTime) => new Date(unixTime).toLocaleString()}
                  formatter={(value, name) => {
                      if (Array.isArray(value)) {
                          return [`Min: ${value[0].toFixed(3)}, Max: ${value[1].toFixed(3)}`, name];
                      }
                      return [Number(value).toFixed(4), name];
                  }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                
                <Legend verticalAlign="top" height={36}/>
                
                {/* Generování čar/ploch pro každý senzor */}
                {(selectedSensor === 'all' ? uniqueSensors : [selectedSensor]).map((sensorName, index) => {
                  const color = sensorColors[index % sensorColors.length];
                  return (
                    <DataComponent 
                      key={sensorName}
                      type="monotone" 
                      dataKey={sensorName} 
                      name={sensorName}
                      stroke={color} // Barva čáry
                      // Specifické pro Area (Obálka)
                      fill={color}
                      fillOpacity={metric === 'envelope' ? 0.3 : 0}
                      // Specifické pro Line
                      strokeWidth={2} 
                      dot={false}
                      activeDot={{ r: 6 }}
                      connectNulls={true} // Propojí body i když chybí data
                      animationDuration={800}
                    />
                  );
                })}
              </ChartComponent>
            </ResponsiveContainer>
          )
        )}
      </div>

      <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#94a3b8', marginTop: '10px' }}>
        Zobrazuji trend: <strong>{metricsInfo[metric].label}</strong>. Použijte filtry pro detailní pohled.
      </p>
    </div>
  );
}

export default MachineGraphs;