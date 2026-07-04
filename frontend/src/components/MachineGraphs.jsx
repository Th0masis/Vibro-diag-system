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
    skewness: { label: 'Skewness (-)', db_key: 'skewness' },
    envelope: { label: 'Signal envelope', db_key: 'rms_acl_env' }
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
        alert("This point comes from the IIoT Connector and does not contain a raw .csv source file. Detailed signal analysis is only available for local raw recordings.");
      }
    }
  };

  return (
    <div className="card-shadow machine-graphs-card">
      
      {/* KLIKACÍ NÁZVY VŠECH PARAMETRŮ (TABS) */}
      <div className="machine-graphs-metric-tabs">
        {Object.keys(metricsInfo).map(key => (
          <button
            key={key}
            onClick={() => setMetric(key)}
            className={`machine-graphs-metric-tab ${metric === key ? 'is-active' : ''}`}
          >
            {metricsInfo[key].label}
          </button>
        ))}
      </div>

      {/* SEKUNDÁRNÍ FILTRY (SENZOR A DATUM) */}
      <div className="machine-graphs-filters">
        <div className="machine-graphs-filter-group">
          <label className="machine-graphs-filter-label">Sensor filter:</label>
          <select className="machine-graphs-filter-control" value={selectedSensor} onChange={(e) => setSelectedSensor(e.target.value)}>
            <option value="all">All sensors</option>
            {uniqueSensors.map(s => <option key={s} value={s}>Sensor {s}</option>)}
          </select>
        </div>

        <div className="machine-graphs-filter-group">
          <label className="machine-graphs-filter-label">From:</label>
          <input className="machine-graphs-filter-control" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>

        <div className="machine-graphs-filter-group">
          <label className="machine-graphs-filter-label">To:</label>
          <input className="machine-graphs-filter-control" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>

      {/* VLASTNÍ GRAF */}
      <div className="machine-graphs-plot-wrap">
        {loading ? (
          <div className="machine-graphs-state">Loading chart data…</div>
        ) : chartData.length === 0 ? (
          <div className="machine-graphs-state">No data for the selected period and filters.</div>
        ) : (
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="timeLabel" tick={{ fontSize: 12, fill: '#64748b' }} tickMargin={10} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} domain={['auto', 'auto']} />
              
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                labelStyle={{ fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '5px' }}
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

      <p className="machine-graphs-tip">
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