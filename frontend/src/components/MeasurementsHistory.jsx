import { useState, useEffect } from 'react';
import axios from 'axios';

function MeasurementsHistory({ machineId }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`http://127.0.0.1:8000/machines/${machineId}/measurements`);
      setData(res.data);
    } catch (error) {
      console.error("Chyba načítání historie:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [machineId]);

  // Funkce pro generování dat (Simulace senzoru)
  const handleSimulate = async () => {
    setSimulating(true);
    try {
      const res = await axios.post(`http://127.0.0.1:8000/machines/${machineId}/simulate`);
      alert(res.data.message); // "Vygenerováno X měření"
      fetchData(); // Obnovíme tabulku
    } catch (error) {
      alert("Chyba: " + (error.response?.data?.detail || "Nelze simulovat"));
    } finally {
      setSimulating(false);
    }
  };

  // Pomocná funkce pro obarvení hodnoty ISO (jednoduchý semafor)
  const getIsoColor = (val) => {
    if (val < 2.5) return '#166534'; // Zelená (OK)
    if (val < 4.5) return '#ca8a04'; // Žlutá (Warning)
    return '#dc2626';                // Červená (Critical)
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0, color: 'var(--text-main)' }}>Naměřené hodnoty</h3>
        <button 
          className="btn-diagnose" 
          onClick={handleSimulate} 
          disabled={simulating}
          style={{ background: simulating ? '#cbd5e1' : 'var(--br-orange)' }}
        >
          {simulating ? 'Měřím...' : '⚡ Simulovat nové měření'}
        </button>
      </div>

      <div className="table-wrapper">
        {loading ? <p>Načítám data...</p> : (
          data.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', background: '#f8fafc', borderRadius: '8px' }}>
              <p>Zatím žádná data.</p>
              <p style={{ fontSize: '0.9rem' }}>Ujistěte se, že má stroj <strong>aktivní senzory</strong>, a klikněte na "Simulovat nové měření".</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Čas měření</th>
                  <th>Pozice / Senzor</th>
                  <th>RMS (mm/s)</th>
                  <th>Peak (mm/s)</th>
                  <th>ISO 10816</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, index) => (
                  <tr key={index}>
                    <td style={{ color: '#64748b' }}>
                      {new Date(row.time).toLocaleString('cs-CZ')}
                    </td>
                    <td>
                      <strong>{row.position}</strong>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{row.sensor}</div>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '1rem' }}>
                        {row.rms.toFixed(3)}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '1rem', color: '#64748b' }}>
                        {row.peak.toFixed(3)}
                    </td>
                    <td>
                      <span style={{ 
                        fontWeight: 'bold', 
                        color: getIsoColor(row.iso),
                        background: getIsoColor(row.iso) + '15', // 15 = hex průhlednost
                        padding: '4px 8px',
                        borderRadius: '6px'
                      }}>
                        {row.iso.toFixed(3)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  );
}

export default MeasurementsHistory;