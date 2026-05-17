import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import MeasurementDetailModal from './MeasurementDetailModal'; 

function MachineGraphs({ machineId }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- STAVY PRO FILTRY ---
  const [metric, setMetric] = useState('rms'); 
  const [selectedSensor, setSelectedSensor] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  // Návrat k modalu
  const [selectedMeasurementId, setSelectedMeasurementId] = useState(null);

  // Definice metrik lícující s novým UNION ALL schématem backendu
  const metricsInfo = {
    rms: { label: 'RMS (g)', db_key: 'rms' },
    peak: { label: 'Peak (g)', db_key: 'peak' },
    kurtosis: { label: 'Kurtosis (-)', db_key: 'kurtosis' },
    skewness: { label: 'Šikmost (-)', db_key: 'skewness' },
    envelope: { label: 'Obálka signálu', db_key: 'rms_acl_env' }
  };

  const sensorColors = ['#0284c7', '#cd3808', '#10b981', '#8b5cf6', '#f59e0b', '#64748b'];

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/machines/${machineId}/history`);
      setData(res.data);
    } catch (error) {
      console.error("Chyba při načítání dat pro grafy:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (machineId) fetchData();
  }, [machineId]);

  const uniqueSensors = useMemo(() => {
    const sensors = new Set(data.map(d => d.sensor_name));
    return Array.from(sensors).sort();
  }, [data]);

  const chartData = useMemo(() => {
    let filtered = data.filter(d => {
      if (d.rms == null) return false; 
      if (selectedSensor !== 'all' && d.sensor_name !== selectedSensor) return false;
      if (dateFrom && new Date(d.timestamp) < new Date(dateFrom)) return false;
      if (dateTo && new Date(d.timestamp) > new Date(dateTo + 'T23:59:59')) return false;
      return true;
    });

    const currentDbKey = metricsInfo[metric].db_key;

    const grouped = {};
    filtered.forEach(d => {
      const time = new Date(d.timestamp);
      time.setSeconds(0, 0); 
      const timeKey = time.toISOString();

      if (!grouped[timeKey]) {
        grouped[timeKey] = { 
          timestamp: time, 
          timeLabel: time.toLocaleString('cs-CZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) 
        };
      }

      grouped[timeKey][d.sensor_name] = d[currentDbKey];
      grouped[timeKey][`${d.sensor_name}_id`] = d.id_measurement;
      grouped[timeKey][`${d.sensor_name}_source`] = d.source;
    });

    return Object.values(grouped).sort((a, b) => a.timestamp - b.timestamp);
  }, [data, metric, selectedSensor, dateFrom, dateTo]);

  const handleDotClick = (payload, sensorName) => {
    const measId = payload[`${sensorName}_id`];
    const source = payload[`${sensorName}_source`];

    if (measId) {
      if (source === 'raw_analysis') {
        setSelectedMeasurementId(measId);
      } else {
        alert("Tento bod je z IIoT Connectoru a neobsahuje zdrojový .csv soubor. Detailní analýza signálu je dostupná pouze u lokálních surových měření.");
      }
    }
  };

  return (
    <div className="card-shadow" style={{ padding: '20px', background: 'white', borderRadius: '8px' }}>
      
      {/* KLIKACÍ NÁZVY VŠECH PARAMETRŮ (TABS) */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px' }}>
        {Object.keys(metricsInfo).map(key => (
          <button
            key={key}
            onClick={() => setMetric(key)}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: metric === key ? '1px solid #cd3808' : '1px solid #cbd5e1',
              background: metric === key ? '#cd3808' : 'white',
              color: metric === key ? 'white' : '#475569',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '0.85rem',
              transition: 'all 0.15s ease-in-out',
              boxShadow: metric === key ? '0 2px 4px rgba(205,56,8,0.2)' : 'none'
            }}
          >
            {metricsInfo[key].label}
          </button>
        ))}
      </div>

      {/* SEKUNDÁRNÍ FILTRY (SENZOR A DATUM) */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '25px', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b' }}>Filtr senzoru:</label>
          <select value={selectedSensor} onChange={(e) => setSelectedSensor(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', color: '#1e293b' }}>
            <option value="all">Všechny senzory</option>
            {uniqueSensors.map(s => <option key={s} value={s}>Senzor {s}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b' }}>Od:</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ padding: '7px', borderRadius: '4px', border: '1px solid #cbd5e1', color: '#1e293b' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b' }}>Do:</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ padding: '7px', borderRadius: '4px', border: '1px solid #cbd5e1', color: '#1e293b' }} />
        </div>
      </div>

      {/* VLASTNÍ GRAF */}
      <div style={{ width: '100%', height: '400px' }}>
        {loading ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>Načítám data grafů...</div>
        ) : chartData.length === 0 ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>Žádná data pro vybrané období a filtry.</div>
        ) : (
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="timeLabel" tick={{ fontSize: 12, fill: '#64748b' }} tickMargin={10} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} domain={['auto', 'auto']} />
              
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                labelStyle={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '5px' }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />

              {uniqueSensors.map((sensorName, index) => {
                if (selectedSensor !== 'all' && selectedSensor !== sensorName) return null;
                return (
                  <Line 
                    key={sensorName}
                    type="monotone" 
                    dataKey={sensorName} 
                    name={`Senzor ${sensorName}`}
                    stroke={sensorColors[index % sensorColors.length]} 
                    strokeWidth={2.5}
                    dot={{ r: 4, strokeWidth: 2, fill: 'white' }}
                    activeDot={{ 
                      r: 7, cursor: 'pointer', strokeWidth: 2, stroke: 'white',
                      onClick: (e, payload) => handleDotClick(payload.payload, sensorName)
                    }}
                    connectNulls={true}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#94a3b8', marginTop: '15px' }}>
        <strong>Tip:</strong> Kliknutím na libovolný bod v grafu otevřete detailní diagnostické rozhraní (FFT/CWT).
      </p>

      {/* ZOBRAZENÍ MODALU */}
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

export default MachineGraphs;