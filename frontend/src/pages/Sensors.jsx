import { useState, useEffect } from 'react';
import axios from 'axios';

function Sensors() {
  const [sensors, setSensors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedSensor, setSelectedSensor] = useState(null);
  const [newSensor, setNewSensor] = useState({
    serial_number: '',
    description: '',
    sampling_rate: '',
    calibration_date: ''
  });

  const fetchSensors = async () => {
    try {
      setLoading(true);
      const response = await axios.get('http://127.0.0.1:8000/sensors');
      setSensors(response.data);
    } catch (error) {
      console.error("Nelze načíst senzory:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSensors();
  }, []);

  const handleAddSensor = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://127.0.0.1:8000/sensors', newSensor);
      setIsAddModalOpen(false);
      setNewSensor({ serial_number: '', description: '', sampling_rate: '', calibration_date: '' });
      fetchSensors();
    } catch (error) {
      alert("Chyba při registraci senzoru: " + error.response?.data?.detail);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Opravdu chcete tento senzor odstranit z evidence?")) {
      try {
        await axios.delete(`http://127.0.0.1:8000/sensors/${id}`);
        fetchSensors();
      } catch (error) {
        alert("Chyba při mazání.");
      }
    }
  };

  return (
    <div className="page-container">
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ color: 'var(--text)', margin: 0 }}>Správa senzorů</h2>
        <button className="btn-diagnose" onClick={() => setIsAddModalOpen(true)}>
          + Registrovat senzor
        </button>
      </div>

      <div className="table-wrapper">
        {loading ? (
          <p style={{ padding: '20px' }}>Načítám senzory...</p>
        ) : (
          <table>
            <thead>
            <tr>
                <th>Sériové číslo</th>
                <th>Model / Popis</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Akce</th>
            </tr>
            </thead>
            <tbody>
            {sensors.map((s) => (
                <tr key={s.id_sensor}>
                <td><strong>{s.serial_number}</strong></td>
                <td>{s.description}</td>
                <td>
                    <span className={`role-badge ${s.status}`}>
                    {s.status === 'available' ? 'K dispozici' : 
                    s.status === 'active' ? 'Aktivní' : 'Údržba'}
                    </span>
                </td>
                <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                    <button className="btn-small-edit" onClick={() => setSelectedSensor(s)}>Detail</button>
                    <button className="btn-small-delete" onClick={() => handleDelete(s.id_sensor)}>Smazat</button>
                    </div>
                </td>
                </tr>
            ))}
            </tbody>
        </table>
        )}
      </div>
      {selectedSensor && (
        <div className="modal-overlay">
            <div className="modal-content sensor-detail-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, color: 'var(--br-orange)' }}>Detail senzoru</h2>
                <span className={`role-badge ${selectedSensor.status}`}>{selectedSensor.status}</span>
            </div>

            <div className="detail-grid">
                <div className="detail-item">
                <label>Sériové číslo</label>
                <p>{selectedSensor.serial_number}</p>
                </div>
                <div className="detail-item">
                <label>Model</label>
                <p>{selectedSensor.description}</p>
                </div>
                <div className="detail-item">
                <label>Sampling Rate</label>
                <p>{selectedSensor.sampling_rate ? `${selectedSensor.sampling_rate} Hz` : 'Nespecifikováno'}</p>
                </div>
                <div className="detail-item">
                <label>Poslední kalibrace</label>
                <p>{selectedSensor.calibration_date ? new Date(selectedSensor.calibration_date).toLocaleDateString('cs-CZ') : 'Neznámo'}</p>
                </div>
                <div className="detail-item">
                <label>Přiřazený stroj</label>
                <p>{selectedSensor.id_machine ? `Stroj ID: ${selectedSensor.id_machine}` : 'Volný (sklad)'}</p>
                </div>
                <div className="detail-item">
                <label>Pozice na stroji</label>
                <p>{selectedSensor.position || '—'}</p>
                </div>
            </div>

            <div className="modal-actions" style={{ marginTop: '30px' }}>
                <button className="btn-update" onClick={() => alert("Zde bude editace dat")}>Upravit údaje</button>
                <button className="btn-cancel" onClick={() => setSelectedSensor(null)}>Zavřít</button>
            </div>
            </div>
        </div>
        )}

      {/* MODAL PRO PŘIDÁNÍ SENZORU */}
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content add-user-modal">
            <h2 style={{ marginBottom: '20px', color: 'var(--br-orange)' }}>Registrace senzoru</h2>
            <form onSubmit={handleAddSensor}>
              <div className="form-group">
                <input 
                  type="text" 
                  placeholder="Sériové číslo (S/N)" 
                  value={newSensor.serial_number}
                  onChange={(e) => setNewSensor({...newSensor, serial_number: e.target.value})}
                  required 
                />
              </div>
              <div className="form-group">
                <input 
                  type="text" 
                  placeholder="Popis (např. Akcelerometr 100mV/g)" 
                  value={newSensor.description}
                  onChange={(e) => setNewSensor({...newSensor, description: e.target.value})}
                  required 
                />
              </div>
              <div className="form-group">
                <input 
                  type="number" 
                  placeholder="Sampling rate (Hz)" 
                  value={newSensor.sampling_rate}
                  onChange={(e) => setNewSensor({...newSensor, sampling_rate: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label style={{ display: 'block', textAlign: 'left', fontSize: '0.8rem', marginBottom: '5px' }}>Datum kalibrace</label>
                <input 
                  type="date" 
                  value={newSensor.calibration_date}
                  onChange={(e) => setNewSensor({...newSensor, calibration_date: e.target.value})}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setIsAddModalOpen(false)}>Zrušit</button>
                <button type="submit" className="btn-add-confirm">Uložit senzor</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Sensors;