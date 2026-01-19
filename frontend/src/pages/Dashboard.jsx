import { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function Dashboard() {
  const [data, setData] = useState([]);
  const [diagnosis, setDiagnosis] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    try {
      setDiagnosis(null);
      const response = await axios.get('http://127.0.0.1:8000/history?limit=50');
      setData(response.data.reverse());
    } catch (error) {
      console.error("Chyba při načítání dat:", error);
    }
  };

  const runDiagnosis = async () => {
    if (data.length === 0) return;
    setLoading(true);
    const latest = data[data.length - 1];
    try {
      const response = await axios.post('http://127.0.0.1:8001/predict', {
        rms: latest.rms_raw,
        kurtosis: latest.kurtosis_raw || latest.kurtosis,
        ptp: latest.peak_raw
      });
      setDiagnosis(response.data);
    } catch (error) {
      console.error("Diagnostika selhala:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <>
      <div className="dashboard-controls">
         <button className="btn-update" onClick={fetchData}>Aktualizovat data</button>
         <button className="btn-diagnose" onClick={runDiagnosis} disabled={loading}>
            {loading ? 'Analyzuji...' : 'Spustit AI Diagnostiku'}
         </button>
      </div>

      {diagnosis && (
        <div className={`diag-panel ${diagnosis.label === 1 ? 'status-fault' : 'status-ok'}`}>
          <h2 style={{ margin: 0 }}>Stav stroje: {diagnosis.status}</h2>
          <p style={{ margin: '8px 0 0 0', opacity: 0.9 }}>
            Jistota modelu: {(diagnosis.confidence * 100).toFixed(1)}% | 
            Poslední RMS: {data[data.length-1]?.rms_raw?.toFixed(2)} mm/s
          </p>
        </div>
      )}

      <div className="chart-container">
        <h3 style={{marginTop: 0}}>Trend Vibrací (Real-time)</h3>
        <div style={{ width: '100%', height: 350 }}>
          <ResponsiveContainer>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
              <XAxis dataKey="time" tickFormatter={(t) => new Date(t).toLocaleTimeString()} stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
              <Legend />
              <Line type="monotone" dataKey="rms_raw" stroke="#487BE3" strokeWidth={4} dot={{r: 0}} name="RMS [mm/s]" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <h3>Detailní log měření</h3>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr><th>Čas</th><th>RMS [mm/s]</th><th>Peak [g]</th><th>Kurtosis [-]</th></tr>
          </thead>
          <tbody>
            {[...data].reverse().slice(0, 15).map((row, index) => (
              <tr key={index}>
                <td>{new Date(row.time).toLocaleString()}</td>
                <td><strong>{row.rms_raw?.toFixed(3)}</strong></td>
                <td>{row.peak_raw?.toFixed(3)}</td>
                <td>{(row.kurtosis_raw || row.kurtosis)?.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default Dashboard;