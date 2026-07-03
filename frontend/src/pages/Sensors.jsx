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
      await axios.post('http://127.0.0.1:8000/sensors', payload);
      setIsAddModalOpen(false);
      setNewSensor({ 
        serial_number: '', description: '', sampling_rate: '', 
        calibration_date: '', position: '', status: 'available', id_machine: '' 
      });
      fetchData();
    } catch (error) {
      alert("Chyba při registraci: " + error.response?.data?.detail);
    }
  };

  const handleUpdateSensor = async (e) => {
    e.preventDefault();
    const payload = { ...editingSensor };
    // Konverze prázdného stringu na null pro backend
    if (payload.id_machine === '' || payload.id_machine === 'null') payload.id_machine = null;

    try {
      await axios.put(`http://127.0.0.1:8000/sensors/${editingSensor.id_sensor}`, payload);
      setEditingSensor(null);
      setSelectedSensor(null);
      fetchData();
    } catch (error) {
      alert("Chyba při aktualizaci.");
    }
  };

  const confirmDelete = async () => {
    try {
      await axios.delete(`http://127.0.0.1:8000/sensors/${sensorToDelete}`);
      setSensorToDelete(null);
      fetchData();
    } catch (error) {
      alert("Chyba při mazání.");
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
    return machine ? machine.name : 'Nepřiřazen';
  };

  return (
    <div className="page-container">
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ color: 'var(--text)', margin: 0 }}>Správa senzorů</h2>
        <button className="btn-diagnose" onClick={() => setIsAddModalOpen(true)}>+ Registrovat senzor</button>
      </div>

      <div className="table-wrapper">
        {loading ? ( <p style={{ padding: '20px' }}>Načítám data...</p> ) : (
          <table>
            <thead>
              <tr>
                <th>Sériové číslo</th>
                <th>Model / Popis</th>
                <th>Přiřazený stroj</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Akce</th>
              </tr>
            </thead>
            <tbody>
              {sensors.map((s) => (
                <tr key={s.id_sensor}>
                  <td><strong>{s.serial_number}</strong></td>
                  <td>{s.description}</td>
                  <td style={{ color: s.id_machine ? 'var(--text)' : '#94a3b8' }}>
                    {s.id_machine ? getMachineName(s.id_machine) : '— Sklad —'}
                  </td>
                  <td>
                    <span className={`role-badge ${s.status}`}>
                      {s.status === 'available' ? 'K dispozici' : s.status === 'active' ? 'Aktivní' : 'Údržba'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                      <button className="btn-small-edit" onClick={() => setSelectedSensor(s)}>Detail</button>
                      <button className="btn-small-delete" onClick={() => setSensorToDelete(s.id_sensor)}>Smazat</button>
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
              <h2 style={{ margin: 0, color: 'var(--primary)' }}>Detail senzoru</h2>
              <span className={`role-badge ${selectedSensor.status}`}>{selectedSensor.status}</span>
            </div>
            <div className="detail-grid">
              <div className="detail-item"><label>S/N</label><p>{selectedSensor.serial_number}</p></div>
              <div className="detail-item"><label>Model</label><p>{selectedSensor.description}</p></div>
              <div className="detail-item"><label>Vzorkování</label><p>{selectedSensor.sampling_rate} Hz</p></div>
              <div className="detail-item"><label>Kalibrace</label><p>{selectedSensor.calibration_date || 'Neznámá'}</p></div>
              
              {/* Zobrazení názvu stroje v detailu */}
              <div className="detail-item" style={{ gridColumn: 'span 2', background: '#f8fafc', padding: '10px', borderRadius: '6px' }}>
                  <label>Umístění</label>
                  <p style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {selectedSensor.id_machine ? (
                        <>
                          <span style={{ fontWeight: 'bold' }}>{getMachineName(selectedSensor.id_machine)}</span>
                          <span style={{ color: '#64748b' }}>📍 {selectedSensor.position}</span>
                        </>
                    ) : 'Sklad (Nepřiřazen)'}
                  </p>
              </div>
            </div>
            <div className="modal-actions" style={{ marginTop: '30px' }}>
              <button className="btn-update" onClick={() => setEditingSensor(selectedSensor)}>Upravit údaje</button>
              <button className="btn-cancel" onClick={() => setSelectedSensor(null)}>Zavřít</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDITACE */}
      {editingSensor && (
        <div className="modal-overlay">
          <div className="modal-content add-user-modal">
            <h2 style={{ color: 'var(--primary)' }}>Upravit senzor</h2>
            <form onSubmit={handleUpdateSensor}>
              <div className="form-group">
                <label>Sériové číslo (S/N)</label>
                <input type="text" value={editingSensor.serial_number} disabled style={{ background: '#f1f5f9' }} />
              </div>

              <div className="form-group">
                <label>Přiřazený stroj</label>
                <select 
                    value={editingSensor.id_machine || ''} 
                    onChange={(e) => handleMachineChange(e, setEditingSensor, editingSensor)}
                >
                    <option value="">-- Nepřiřazeno (Sklad) --</option>
                    {machines.map(m => (
                        <option key={m.id_machine} value={m.id_machine}>
                            {m.name} (ID: {m.id_machine})
                        </option>
                    ))}
                </select>
              </div>

              {/* Pozice a Status se zobrazí, jen pokud je vybrán stroj, nebo naopak */}
              <div className="detail-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="form-group">
                    <label>Status</label>
                    <select 
                        value={editingSensor.status} 
                        onChange={(e) => setEditingSensor({...editingSensor, status: e.target.value})}
                    >
                        {/* Logika: Pokud je vybrán stroj, neměl by být Available. Pokud není stroj, musí být Available. */}
                        <option value="available" disabled={!!editingSensor.id_machine}>K dispozici (Sklad)</option>
                        <option value="active" disabled={!editingSensor.id_machine}>Aktivní (V provozu)</option>
                        <option value="maintenance">Údržba</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Pozice na stroji</label>
                    <input 
                        type="text" 
                        value={editingSensor.position || ''} 
                        onChange={(e) => setEditingSensor({...editingSensor, position: e.target.value})}
                        placeholder={editingSensor.id_machine ? "Povinné" : "Nerelevantní"}
                        disabled={!editingSensor.id_machine}
                    />
                  </div>
              </div>

              <div className="form-group">
                <label>Popis / Model</label>
                <input type="text" value={editingSensor.description} onChange={(e) => setEditingSensor({...editingSensor, description: e.target.value})} required />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setEditingSensor(null)}>Zpět</button>
                <button type="submit" className="btn-add-confirm">Uložit změny</button>
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
        title="Potvrdit smazání senzoru"
        message="Opravdu chcete tento senzor trvale odstranit z evidence? Tuto akci nelze vzít zpět."
      />

      {/* MODAL: REGISTRACE NOVÉHO */}
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content add-user-modal">
            <h2 style={{ color: 'var(--primary)' }}>Nový senzor</h2>
            <form onSubmit={handleAddSensor}>
              <div className="form-group">
                <label>Sériové číslo *</label>
                <input type="text" onChange={(e) => setNewSensor({...newSensor, serial_number: e.target.value})} required />
              </div>
              
              <div className="form-group">
                <label>Přiřadit ke stroji (Volitelné)</label>
                <select 
                    value={newSensor.id_machine} 
                    onChange={(e) => handleMachineChange(e, setNewSensor, newSensor)}
                >
                    <option value="">-- Nepřiřazeno (Sklad) --</option>
                    {machines.map(m => (
                        <option key={m.id_machine} value={m.id_machine}>{m.name}</option>
                    ))}
                </select>
              </div>

              {newSensor.id_machine && (
                  <div className="form-group">
                    <label>Pozice na stroji *</label>
                    <input 
                        type="text" 
                        placeholder="Např. Ložisko 1" 
                        value={newSensor.position}
                        onChange={(e) => setNewSensor({...newSensor, position: e.target.value})}
                        required
                    />
                  </div>
              )}

              <div className="form-group">
                <label>Popis *</label>
                <input type="text" onChange={(e) => setNewSensor({...newSensor, description: e.target.value})} required />
              </div>
              
              <div className="detail-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                    <label>Sampling Rate (Hz)</label>
                    <input type="number" onChange={(e) => setNewSensor({...newSensor, sampling_rate: e.target.value})} />
                </div>
                <div className="form-group">
                    <label>Kalibrace</label>
                    <input type="date" onChange={(e) => setNewSensor({...newSensor, calibration_date: e.target.value})} />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setIsAddModalOpen(false)}>Zrušit</button>
                <button type="submit" className="btn-add-confirm">Registrovat</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Sensors;