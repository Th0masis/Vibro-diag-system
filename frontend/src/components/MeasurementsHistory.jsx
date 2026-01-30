import { useState, useEffect } from 'react';
import axios from 'axios';
// Předpokládám, že detailní náhled budeme chtít v modalu
import MeasurementDetailModal from './MeasurementDetailModal.jsx'; 

function MeasurementsHistory({ machineId }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [selectedMeasurementId, setSelectedMeasurementId] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`http://127.0.0.1:8000/machines/${machineId}/history`);
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

  const handleExtractFeatures = async (id_measurement) => {
    setProcessingId(id_measurement);
    try {
      // Endpoint v ml_service, který provede výpočet
      await axios.post(`http://127.0.0.1:8000/measurements/${id_measurement}/process`);
      fetchData(); // Obnovíme data po výpočtu
    } catch (error) {
      alert("Chyba při analýze dat.");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0, color: 'var(--text-main)' }}>Historie měření a analýz</h3>
        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
          Stroj ID: {machineId}
        </div>
      </div>

      <div className="table-wrapper">
        {loading ? <p>Načítám data...</p> : (
          data.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', background: '#f8fafc', borderRadius: '8px' }}>
              <p>Zatím žádné záznamy v databázi.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Čas měření</th>
                  <th>Senzor</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Akce</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.id_measurement}>
                    <td style={{ color: '#64748b' }}>
                      {new Date(row.timestamp).toLocaleString('cs-CZ')}
                    </td>
                    <td>
                      <span className="badge-sensor">{row.sensor_name}</span>
                    </td>
                    <td>
                      {row.processed ? (
                        <span style={{ 
                          color: '#166534', 
                          background: '#16653415', 
                          padding: '4px 10px', 
                          borderRadius: '20px',
                          fontSize: '0.85rem',
                          fontWeight: '500'
                        }}>
                          ✅ Zpracováno
                        </span>
                      ) : (
                        <span style={{ 
                          color: '#64748b', 
                          background: '#f1f5f9', 
                          padding: '4px 10px', 
                          borderRadius: '20px',
                          fontSize: '0.85rem',
                          fontWeight: '500'
                        }}>
                          ⏳ Čeká na zpracování
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                        {!row.processed && (
                          <button 
                            className="btn-action-small"
                            onClick={() => handleExtractFeatures(row.id_measurement)}
                            disabled={processingId === row.id_measurement}
                            style={{ 
                              background: 'var(--br-orange)', 
                              color: 'white', 
                              border: 'none', 
                              padding: '5px 12px', 
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            {processingId === row.id_measurement ? 'Počítám...' : '⚙️ Zpracovat'}
                          </button>
                        )}
                        <button 
                          className="btn-action-small"
                          onClick={() => setSelectedMeasurementId(row.id_measurement)}
                          style={{ 
                            background: '#3b82f6', 
                            color: 'white', 
                            border: 'none', 
                            padding: '5px 12px', 
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          🔍 Detail
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>

      {/* Modal pro detail měření s grafem (vytvoříme v dalším kroku) */}
      {selectedMeasurementId && (
        <MeasurementDetailModal 
          measurementId={selectedMeasurementId} 
          onClose={() => setSelectedMeasurementId(null)} 
        />
      )}
    </div>
  );
}

export default MeasurementsHistory;