import { useState, useEffect } from 'react';
import axios from 'axios';

function Sensors() {
  const [sensors, setSensors] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedSensor, setSelectedSensor] = useState(null);
  const [editingSensor, setEditingSensor] = useState(null);
  const [sensorToDelete, setSensorToDelete] = useState(null);

  const [newSensor, setNewSensor] = useState({
    serial_number: '',
    description: '',
    sampling_rate: '',
    calibration_date: '',
    position: '',
    status: 'available'
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

  useEffect(() => { fetchSensors(); }, []);

  const handleAddSensor = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://127.0.0.1:8000/sensors', newSensor);
      setIsAddModalOpen(false);
      // Resetování všech polí
      setNewSensor({ 
        serial_number: '', 
        description: '', 
        sampling_rate: '', 
        calibration_date: '', 
        position: '', 
        status: 'available' 
      });
      fetchSensors();
    } catch (error) {
      alert("Chyba při registraci senzoru: " + error.response?.data?.detail);
    }
  };

  const handleUpdateSensor = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`http://127.0.0.1:8000/sensors/${editingSensor.id_sensor}`, editingSensor);
      setEditingSensor(null);
      setSelectedSensor(null); // Zavřít i detail po uložení
      fetchSensors();
    } catch (error) {
      alert("Chyba při aktualizaci.");
    }
  };

  const confirmDelete = async () => {
    try {
      await axios.delete(`http://127.0.0.1:8000/sensors/${sensorToDelete}`);
      setSensorToDelete(null);
      fetchSensors();
    } catch (error) {
      alert("Chyba při mazání.");
    }
  };

  return (
    <div className="page-container">
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ color: 'var(--br-orange-dark)', margin: 0 }}>List of sensors</h2>
        <button className="btn-diagnose" onClick={() => setIsAddModalOpen(true)}>+ Register a new sensor</button>
      </div>

      <div className="table-wrapper">
        {loading ? ( <p style={{ padding: '20px' }}>Loading sensors...</p> ) : (
          <table>
            <thead>
              <tr>
                <th>Serial number</th>
                <th>Model / Description</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sensors.map((s) => (
                <tr key={s.id_sensor}>
                  <td><strong>{s.serial_number}</strong></td>
                  <td>{s.description}</td>
                  <td>
                    <span className={`role-badge ${s.status}`}>
                      {s.status === 'available' ? 'Available' : s.status === 'active' ? 'In use' : 'Maintenance'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                      <button className="btn-small-edit" onClick={() => setSelectedSensor(s)}>Detail</button>
                      <button className="btn-small-delete" onClick={() => setSensorToDelete(s.id_sensor)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL: DETAIL SENZORU */}
      {selectedSensor && !editingSensor && (
        <div className="modal-overlay">
          <div className="modal-content sensor-detail-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: 'var(--br-orange)' }}>Sensor details</h2>
              <span className={`role-badge ${selectedSensor.status}`}>{selectedSensor.status}</span>
            </div>
            <div className="detail-grid">
              <div className="detail-item"><label>S/N</label><p>{selectedSensor.serial_number}</p></div>
              <div className="detail-item"><label>Model</label><p>{selectedSensor.description}</p></div>
              <div className="detail-item"><label>Sampling rate</label><p>{selectedSensor.sampling_rate} Hz</p></div>
              <div className="detail-item"><label>Calibration date</label><p>{selectedSensor.calibration_date || 'Unknown'}</p></div>
              <div className="detail-item"><label>Machine ID</label><p>{selectedSensor.id_machine || 'Not registered to any machine'}</p></div>
              <div className="detail-item"><label>Position</label><p>{selectedSensor.position || '—'}</p></div>
            </div>
            <div className="modal-actions" style={{ marginTop: '30px' }}>
              <button className="btn-update" onClick={() => setEditingSensor(selectedSensor)}>Edit</button>
              <button className="btn-cancel" onClick={() => setSelectedSensor(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDITACE (Spouští se z detailu) */}
      {editingSensor && (
        <div className="modal-overlay">
          <div className="modal-content add-user-modal" style={{ borderTop: '6px solid var(--br-orange)' }}>
            <h2 style={{ color: 'var(--br-orange)', marginBottom: '20px' }}>Edit sensor details</h2>
            <form onSubmit={handleUpdateSensor}>
              
              <div className="form-group">
                <label>Serial number (S/N)</label>
                <input 
                  type="text" 
                  value={editingSensor.serial_number} 
                  disabled 
                  style={{ background: '#f1f5f9', cursor: 'not-allowed' }}
                />
                <small>Serial number cannot be changed.</small>
              </div>

              <div className="form-group">
                <label>Desription / Model</label>
                <input 
                  type="text" 
                  value={editingSensor.description} 
                  onChange={(e) => setEditingSensor({...editingSensor, description: e.target.value})} 
                  required
                />
              </div>

              <div className="form-group">
                <label>Status</label>
                <select 
                  value={editingSensor.status} 
                  onChange={(e) => setEditingSensor({...editingSensor, status: e.target.value})}
                >
                  <option value="available">Available (In stock)</option>
                  <option value="active">Active (In use)</option>
                  <option value="maintenance">Maintenance / Calibration</option>
                </select>
              </div>

              <div className="detail-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label>Sampling Rate (Hz)</label>
                  <input 
                    type="number" 
                    value={editingSensor.sampling_rate || ''} 
                    onChange={(e) => setEditingSensor({...editingSensor, sampling_rate: e.target.value})} 
                  />
                </div>
                <div className="form-group">
                  <label>Calibration date</label>
                  <input 
                    type="date" 
                    value={editingSensor.calibration_date || ''} 
                    onChange={(e) => setEditingSensor({...editingSensor, calibration_date: e.target.value})} 
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Position on machine</label>
                <input 
                  type="text" 
                  placeholder="např. Ložiskový dům A - Radiální"
                  value={editingSensor.position || ''} 
                  onChange={(e) => setEditingSensor({...editingSensor, position: e.target.value})} 
                />
              </div>

              {/* Poznámka: id_machine budeme řešit, až budeme mít tabulku strojů */}

              <div className="modal-actions" style={{ marginTop: '25px' }}>
                <button type="button" className="btn-cancel" onClick={() => setEditingSensor(null)}>Back to details</button>
                <button type="submit" className="btn-add-confirm">Save changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: POTVRZENÍ SMAZÁNÍ */}
      {sensorToDelete && (
        <div className="modal-overlay">
          <div className="modal-content delete-modal">
            <h3 style={{ color: 'var(--vut-red)' }}>Confirm deletion</h3>
            <p>Are you sure that you want to permanently delete this sensor ?</p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setSensorToDelete(null)}>Cancel</button>
              <button className="btn-confirm-delete" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PRO PŘIDÁNÍ SENZORU */}
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content add-user-modal" style={{ borderTop: '6px solid var(--br-orange)' }}>
            <h2 style={{ marginBottom: '20px', color: 'var(--br-orange)' }}>Registration of new sensor</h2>
            <form onSubmit={handleAddSensor}>
              
              <div className="form-group">
                <label>Serial number (S/N) *</label>
                <input 
                  type="text" 
                  placeholder="for example ACC-2024-001" 
                  value={newSensor.serial_number}
                  onChange={(e) => setNewSensor({...newSensor, serial_number: e.target.value})}
                  required 
                />
              </div>

              <div className="form-group">
                <label>Description/ Model *</label>
                <input 
                  type="text" 
                  placeholder="for example B&R Industrial Accelerometer (100mV/g)" 
                  value={newSensor.description}
                  onChange={(e) => setNewSensor({...newSensor, description: e.target.value})}
                  required 
                />
              </div>

              <div className="detail-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label>Sampling Rate (Hz)</label>
                  <input 
                    type="number" 
                    placeholder="25600"
                    value={newSensor.sampling_rate}
                    onChange={(e) => setNewSensor({...newSensor, sampling_rate: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Calibration date</label>
                  <input 
                    type="date" 
                    value={newSensor.calibration_date}
                    onChange={(e) => setNewSensor({...newSensor, calibration_date: e.target.value})}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Position on machine (optional)</label>
                <input 
                  type="text" 
                  placeholder="for example Ložiskový dům 1 - Radiální" 
                  value={newSensor.position}
                  onChange={(e) => setNewSensor({...newSensor, position: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label>Status</label>
                <select 
                  value={newSensor.status}
                  onChange={(e) => setNewSensor({...newSensor, status: e.target.value})}
                >
                  <option value="available">Available (In stock)</option>
                  <option value="active">Active (In use)</option>
                  <option value="maintenance">Maintenance / Calibration</option>
                </select>
              </div>

              <div className="modal-actions" style={{ marginTop: '25px' }}>
                <button type="button" className="btn-cancel" onClick={() => setIsAddModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-add-confirm">Register sensor</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Sensors;