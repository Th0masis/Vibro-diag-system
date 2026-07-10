import { useState, useEffect } from 'react';
import axios from 'axios';

import ConfirmModal from '../components/ConfirmModal';

function Sensors() {
  const [sensors, setSensors] = useState([]);
  const [machines, setMachines] = useState([]); // NOVÉ: Seznam strojů pro dropdown
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
    status: 'available',
    id_machine: ''
  });

  const formatStatusLabel = (status) => {
    if (status === 'active') return 'Active';
    if (status === 'maintenance') return 'Maintenance';
    return 'Available';
  };

  // Načtení senzorů I strojů
  const fetchData = async () => {
    try {
      setLoading(true);
      const [sensorsRes, machinesRes] = await Promise.all([
        axios.get('/sensors'),
        axios.get('/machines')
      ]);
      setSensors(sensorsRes.data);
      setMachines(machinesRes.data);
    } catch (error) {
      console.error("Chyba při načítání dat:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // --- HANDLERS ---

  const handleAddSensor = async (e) => {
    e.preventDefault();
    const payload = { ...newSensor };
    if (payload.id_machine === '') payload.id_machine = null;

    try {
      await axios.post('/sensors', payload);
      setIsAddModalOpen(false);
      setNewSensor({ 
        serial_number: '', description: '', sampling_rate: '', 
        calibration_date: '', position: '', status: 'available', id_machine: '' 
      });
      fetchData();
    } catch (error) {
      alert('Failed to register sensor: ' + error.response?.data?.detail);
    }
  };

  const handleUpdateSensor = async (e) => {
    e.preventDefault();
    const payload = { ...editingSensor };
    // Konverze prázdného stringu na null pro backend
    if (payload.id_machine === '' || payload.id_machine === 'null') payload.id_machine = null;

    try {
      await axios.put(`/sensors/${editingSensor.id_sensor}`, payload);
      setEditingSensor(null);
      setSelectedSensor(null);
      fetchData();
    } catch (error) {
      alert('Update failed.');
    }
  };

  const confirmDelete = async () => {
    try {
      await axios.delete(`/sensors/${sensorToDelete}`);
      setSensorToDelete(null);
      fetchData();
    } catch (error) {
      alert('Delete failed.');
    }
  };

  // Pomocná funkce: Když vyberu stroj, automaticky nastav status na Active
  const handleMachineChange = (e, setter, currentState) => {
    const machineId = e.target.value;
    const updates = { id_machine: machineId };
    
    if (machineId) {
      updates.status = 'active'; // Připojuji ke stroji -> musí být aktivní
    } else {
      updates.status = 'available'; // Odpojuji -> jde do skladu
      updates.position = '';
    }
    setter({ ...currentState, ...updates });
  };

  // Pomocná funkce pro získání názvu stroje podle ID
  const getMachineName = (id) => {
    const machine = machines.find(m => m.id_machine === id);
    return machine ? machine.name : 'Unassigned';
  };

  return (
    <div className="page-container">
      <div className="section-header section-header-row">
        <h2 className="section-header-title">Sensor Management</h2>
        <button className="btn-diagnose" onClick={() => setIsAddModalOpen(true)}>+ Register sensor</button>
      </div>

      <div className="table-wrapper">
        {loading ? ( <p style={{ padding: '20px' }}>Loading data...</p> ) : (
          <table>
            <thead>
              <tr>
                <th>Serial number</th>
                <th>Model / Description</th>
                <th>Assigned machine</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sensors.map((s) => (
                <tr key={s.id_sensor}>
                  <td><strong>{s.serial_number}</strong></td>
                  <td>{s.description}</td>
                  <td className={s.id_machine ? '' : 'table-cell-muted'}>
                    {s.id_machine ? getMachineName(s.id_machine) : '— Warehouse —'}
                  </td>
                  <td>
                    <span className={`role-badge ${s.status}`}>
                      {formatStatusLabel(s.status)}
                    </span>
                  </td>
                  <td className="table-actions-center">
                    <div className="machine-sensors-actions-wrap">
                      <button
                        className="sensor-btn sensor-btn-detail"
                        onClick={() => setSelectedSensor(s)}
                        title="View sensor details"
                        aria-label="View sensor details"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                      </button>
                      <button
                        className="sensor-btn sensor-btn-delete"
                        onClick={() => setSensorToDelete(s.id_sensor)}
                        title="Delete sensor"
                        aria-label="Delete sensor"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL: SENSOR DETAIL */}
      {selectedSensor && !editingSensor && (
        <div className="modal-overlay">
          <div className="modal-content sensor-detail-card">
            <div className="modal-header-row">
              <h2 className="modal-title-primary">Sensor detail</h2>
              <span className={`role-badge ${selectedSensor.status}`}>{formatStatusLabel(selectedSensor.status)}</span>
            </div>
            <div className="detail-grid">
              <div className="detail-item"><label>S/N</label><p>{selectedSensor.serial_number}</p></div>
              <div className="detail-item"><label>Model</label><p>{selectedSensor.description}</p></div>
              <div className="detail-item"><label>Sampling</label><p>{selectedSensor.sampling_rate} Hz</p></div>
              <div className="detail-item"><label>Calibration</label><p>{selectedSensor.calibration_date || 'Unknown'}</p></div>
              
              {/* Show assigned machine in detail */}
              <div className="detail-item detail-item-highlight">
                  <label>Placement</label>
                  <p className="machine-position-meta">
                    {selectedSensor.id_machine ? (
                        <>
                          <span className="machine-position-name">{getMachineName(selectedSensor.id_machine)}</span>
                          <span className="machine-position-muted">Position: {selectedSensor.position}</span>
                        </>
                    ) : 'Warehouse (Unassigned)'}
                  </p>
              </div>
            </div>
            <div className="modal-actions" style={{ marginTop: '30px' }}>
              <button className="btn-update" onClick={() => setEditingSensor(selectedSensor)}>Edit details</button>
              <button className="btn-cancel" onClick={() => setSelectedSensor(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT */}
      {editingSensor && (
        <div className="modal-overlay">
          <div className="modal-content add-user-modal">
            <h2 className="modal-title-primary">Edit sensor</h2>
            <form onSubmit={handleUpdateSensor}>
              <div className="form-group">
                <label>Serial number (S/N)</label>
                <input type="text" value={editingSensor.serial_number} disabled className="form-input-disabled" />
              </div>

              <div className="form-group">
                <label>Assigned machine</label>
                <select 
                    value={editingSensor.id_machine || ''} 
                    onChange={(e) => handleMachineChange(e, setEditingSensor, editingSensor)}
                >
                    <option value="">-- Unassigned (Warehouse) --</option>
                    {machines.map(m => (
                        <option key={m.id_machine} value={m.id_machine}>
                            {m.name} (ID: {m.id_machine})
                        </option>
                    ))}
                </select>
              </div>

              {/* Placement and status depend on assigned machine */}
              <div className="detail-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="form-group">
                    <label>Status</label>
                    <select 
                        value={editingSensor.status} 
                        onChange={(e) => setEditingSensor({...editingSensor, status: e.target.value})}
                    >
                        <option value="available" disabled={!!editingSensor.id_machine}>Available (Warehouse)</option>
                        <option value="active" disabled={!editingSensor.id_machine}>Active (In operation)</option>
                        <option value="maintenance">Maintenance</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Machine position</label>
                    <input 
                        type="text" 
                        value={editingSensor.position || ''} 
                        onChange={(e) => setEditingSensor({...editingSensor, position: e.target.value})}
                        placeholder={editingSensor.id_machine ? "Required" : "Not applicable"}
                        disabled={!editingSensor.id_machine}
                    />
                  </div>
              </div>

              <div className="form-group">
                <label>Description / Model</label>
                <input type="text" value={editingSensor.description} onChange={(e) => setEditingSensor({...editingSensor, description: e.target.value})} required />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setEditingSensor(null)}>Back</button>
                <button type="submit" className="btn-add-confirm">Save changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Smazání (zůstává stejný) */}
      <ConfirmModal 
        isOpen={!!sensorToDelete}
        onClose={() => setSensorToDelete(null)}
        onConfirm={confirmDelete}
        title="Confirm sensor deletion"
        message="Are you sure you want to permanently delete this sensor? This cannot be undone."
      />

      {/* MODAL: REGISTER NEW SENSOR */}
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content add-user-modal">
            <h2 className="modal-title-primary">New sensor</h2>
            <form onSubmit={handleAddSensor}>
              <div className="form-group">
                <label>Serial number *</label>
                <input type="text" onChange={(e) => setNewSensor({...newSensor, serial_number: e.target.value})} required />
              </div>
              
              <div className="form-group">
                <label>Assign to machine (optional)</label>
                <select 
                    value={newSensor.id_machine} 
                    onChange={(e) => handleMachineChange(e, setNewSensor, newSensor)}
                >
                    <option value="">-- Unassigned (Warehouse) --</option>
                    {machines.map(m => (
                        <option key={m.id_machine} value={m.id_machine}>{m.name}</option>
                    ))}
                </select>
              </div>

              {newSensor.id_machine && (
                  <div className="form-group">
                  <label>Machine position *</label>
                    <input 
                        type="text" 
                    placeholder="e.g. Bearing 1" 
                        value={newSensor.position}
                        onChange={(e) => setNewSensor({...newSensor, position: e.target.value})}
                        required
                    />
                  </div>
              )}

              <div className="form-group">
                <label>Description *</label>
                <input type="text" onChange={(e) => setNewSensor({...newSensor, description: e.target.value})} required />
              </div>
              
              <div className="detail-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                    <label>Sampling Rate (Hz)</label>
                    <input type="number" onChange={(e) => setNewSensor({...newSensor, sampling_rate: e.target.value})} />
                </div>
                <div className="form-group">
                    <label>Calibration</label>
                    <input type="date" onChange={(e) => setNewSensor({...newSensor, calibration_date: e.target.value})} />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setIsAddModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-add-confirm">Register</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Sensors;