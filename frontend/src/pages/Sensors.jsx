import { useState, useEffect } from 'react';
import axios from 'axios';

import { useToast } from '../components/ToastProvider';
import PageTitle from '../components/PageTitle';

const DEFAULT_MODULE_PATH = 'IF3.ST1.IF1.ST2';
const CHANNEL_OPTIONS = [1, 2, 3, 4];

function normalizeSensorPayload(raw) {
  const payload = { ...raw };

  payload.id_machine = payload.id_machine === '' || payload.id_machine === 'null'
    ? null
    : Number(payload.id_machine);

  payload.channel_no = payload.channel_no === '' || payload.channel_no === 'null'
    ? null
    : Number(payload.channel_no);

  payload.sampling_rate = payload.sampling_rate === '' || payload.sampling_rate == null
    ? null
    : Number(payload.sampling_rate);

  payload.calibration_date = payload.calibration_date ? payload.calibration_date : null;
  payload.position = payload.position ? payload.position.trim() : null;
  payload.module_path = payload.module_path ? payload.module_path.trim() : null;

  return payload;
}

function buildSensorErrorMessage(error, fallback) {
  const detail = String(error?.response?.data?.detail || '').trim();
  if (!detail) return fallback;

  if (/idx_sensors_module_channel_unique|idx_sensors_machine_module_channel_unique|module_path.*channel|already exists|obsazen/i.test(detail)) {
    return 'Module path + channel is already occupied globally.';
  }

  if (/calibration_date|invalid input syntax for type date/i.test(detail)) {
    return 'Calibration date must be a valid date (YYYY-MM-DD) or empty.';
  }

  if (/sampling_rate/i.test(detail)) {
    return 'Sampling rate must be a whole number.';
  }

  return detail.length > 220 ? `${detail.slice(0, 220)}...` : detail;
}

function normalizeListPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.machines)) return payload.machines;
  if (Array.isArray(payload?.sensors)) return payload.sensors;
  return [];
}

function Sensors() {
  const toast = useToast();
  const [sensors, setSensors] = useState([]);
  const [machines, setMachines] = useState([]); // NOVÉ: Seznam strojů pro dropdown
  const [loading, setLoading] = useState(true);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedSensor, setSelectedSensor] = useState(null);
  const [editingSensor, setEditingSensor] = useState(null);

  const [newSensor, setNewSensor] = useState({
    serial_number: '',
    description: '',
    sampling_rate: '',
    calibration_date: '',
    position: '',
    module_path: DEFAULT_MODULE_PATH,
    channel_no: '',
    status: 'available',
    id_machine: ''
  });
  const [addTouched, setAddTouched] = useState({});
  const [addErrors, setAddErrors] = useState({});
  const [addLiveValidation, setAddLiveValidation] = useState({});

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
      setSensors(normalizeListPayload(sensorsRes.data));
      setMachines(normalizeListPayload(machinesRes.data));
    } catch (error) {
      console.error("Chyba při načítání dat:", error);
      setSensors([]);
      setMachines([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // --- HANDLERS ---

  const hasChannelCollision = (modulePath, channelNo, ignoreSensorId = null) => {
    if (channelNo == null) return false;
    const normalizedModulePath = String(modulePath || '').trim();
    if (!normalizedModulePath) return false;

    return sensors.some((s) => {
      if (ignoreSensorId != null && s.id_sensor === ignoreSensorId) return false;
      if (s.deleted_at) return false; // Ignore soft-deleted sensors
      return (
        Number(s.channel_no) === Number(channelNo) &&
        String(s.module_path || '').trim() === normalizedModulePath
      );
    });
  };

  const validateAddField = (field, value, draft) => {
    const isMachineAssigned = Boolean(draft.id_machine);
    const trimmed = typeof value === 'string' ? value.trim() : value;

    if (field === 'serial_number') {
      return trimmed ? '' : 'Serial number is required.';
    }

    if (field === 'description') {
      return trimmed ? '' : 'Description is required.';
    }

    if (field === 'channel_no') {
      if (!isMachineAssigned) return '';
      if (value === '' || value == null) return 'Channel is required when machine is selected.';
      if (!String(draft.module_path || '').trim()) return 'Enter module path first.';
      if (hasChannelCollision(draft.module_path, value)) return 'Module path + channel is already occupied globally.';
      return '';
    }

    if (field === 'module_path') {
      if (!isMachineAssigned) return '';
      if (!trimmed) return 'Module path is required when machine is selected.';
      if (draft.channel_no !== '' && draft.channel_no != null && hasChannelCollision(trimmed, draft.channel_no)) {
        return 'Module path + channel is already occupied globally.';
      }
      return '';
    }

    if (field === 'position') {
      if (!isMachineAssigned) return '';
      return trimmed ? '' : 'Machine position is required when machine is selected.';
    }

    if (field === 'sampling_rate') {
      if (value === '' || value == null) return '';
      return /^\d+$/.test(String(value)) && Number(value) > 0
        ? ''
        : 'Sampling rate must be a positive whole number.';
    }

    if (field === 'calibration_date') {
      if (!value) return '';
      return /^\d{4}-\d{2}-\d{2}$/.test(String(value))
        ? ''
        : 'Calibration date must use YYYY-MM-DD format.';
    }

    return '';
  };

  const runAddValidation = (draft) => {
    const fields = ['serial_number', 'description', 'sampling_rate', 'calibration_date'];
    if (draft.id_machine) {
      fields.push('channel_no', 'module_path', 'position');
    }

    const nextErrors = {};
    fields.forEach((field) => {
      nextErrors[field] = validateAddField(field, draft[field], draft);
    });

    setAddErrors(nextErrors);
    setAddTouched(fields.reduce((acc, field) => ({ ...acc, [field]: true }), {}));

    const failedFields = fields.filter((field) => nextErrors[field]);
    if (failedFields.length > 0) {
      setAddLiveValidation((prev) => ({
        ...prev,
        ...failedFields.reduce((acc, field) => ({ ...acc, [field]: true }), {})
      }));
    }

    return failedFields.length === 0;
  };

  const handleAddFieldBlur = (field) => {
    setAddTouched((prev) => ({ ...prev, [field]: true }));
    const message = validateAddField(field, newSensor[field], newSensor);
    setAddErrors((prev) => ({ ...prev, [field]: message }));
    if (message) {
      setAddLiveValidation((prev) => ({ ...prev, [field]: true }));
    }
  };

  const getAddInputClass = (field) => {
    if (!addTouched[field]) return '';
    if (addErrors[field]) return 'form-input-error';

    const value = newSensor[field];
    const hasValue = value !== '' && value != null;
    if (!hasValue) return '';

    if (!newSensor.id_machine && ['channel_no', 'module_path', 'position'].includes(field)) return '';

    return 'form-input-success';
  };

  useEffect(() => {
    const liveFields = Object.keys(addLiveValidation).filter((field) => addLiveValidation[field]);
    if (liveFields.length === 0) return;

    setAddErrors((prev) => {
      const next = { ...prev };
      liveFields.forEach((field) => {
        next[field] = validateAddField(field, newSensor[field], newSensor);
      });
      return next;
    });
  }, [newSensor, addLiveValidation, sensors]);

  const handleAddSensor = async (e) => {
    e.preventDefault();
    const payload = normalizeSensorPayload(newSensor);

    if (!runAddValidation(newSensor)) {
      toast.warning('Please fix highlighted fields before registering the sensor.');
      return;
    }

    if (hasChannelCollision(payload.module_path, payload.channel_no)) {
      toast.warning('This module path + channel is already occupied globally.');
      return;
    }

    try {
      await axios.post('/sensors', payload);
      setIsAddModalOpen(false);
      setNewSensor({ 
        serial_number: '', description: '', sampling_rate: '', 
        calibration_date: '', position: '', module_path: DEFAULT_MODULE_PATH, channel_no: '', status: 'available', id_machine: '' 
      });
      setAddTouched({});
      setAddErrors({});
      setAddLiveValidation({});
      fetchData();
      toast.success('Sensor registered successfully.');
    } catch (error) {
      toast.error(buildSensorErrorMessage(error, 'Failed to register sensor.'));
    }
  };

  const handleUpdateSensor = async (e) => {
    e.preventDefault();
    const payload = normalizeSensorPayload(editingSensor);

    if (hasChannelCollision(payload.module_path, payload.channel_no, editingSensor.id_sensor)) {
      toast.warning('This module path + channel is already occupied globally.');
      return;
    }

    try {
      await axios.put(`/sensors/${editingSensor.id_sensor}`, payload);
      setEditingSensor(null);
      setSelectedSensor(null);
      fetchData();
      toast.success('Sensor updated.');
    } catch (error) {
      toast.error(buildSensorErrorMessage(error, 'Update failed.'));
    }
  };

  const confirmDelete = async (sensor) => {
    // Optimistic soft-delete: remove from the list immediately and offer Undo
    // instead of an "Are you sure?" dialog (low-risk, reversible action).
    setSensors((prev) => prev.filter((s) => s.id_sensor !== sensor.id_sensor));

    try {
      await axios.delete(`/sensors/${sensor.id_sensor}`);
      toast.undo(`Sensor "${sensor.serial_number}" deleted.`, async () => {
        try {
          await axios.post(`/sensors/${sensor.id_sensor}/restore`);
          fetchData();
          toast.success('Sensor restored.');
        } catch (error) {
          toast.error('Failed to restore sensor.');
        }
      });
    } catch (error) {
      toast.error('Delete failed.');
      fetchData();
    }
  };

  // Pomocná funkce: Když vyberu stroj, automaticky nastav status na Active
  const handleMachineChange = (e, setter, currentState) => {
    const machineId = e.target.value;
    const updates = { id_machine: machineId };
    
    if (machineId) {
      updates.status = 'active'; // Připojuji ke stroji -> musí být aktivní
      if (!currentState.module_path) updates.module_path = DEFAULT_MODULE_PATH;
    } else {
      updates.status = 'available'; // Odpojuji -> jde do skladu
      updates.position = '';
      updates.channel_no = '';
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
      <PageTitle title="Sensor Management">
        <button className="btn-diagnose" onClick={() => setIsAddModalOpen(true)}>+ Register sensor</button>
      </PageTitle>

      <div className="detail-layout">
        {/* LEFT PANEL: SENSOR LIST */}
        <div className="detail-card card-tech detail-catalog-card">
          <div className="detail-catalog-header">
            <h3 className="card-title detail-catalog-title">Sensor inventory</h3>
            <span className="detail-catalog-count">{sensors.length}</span>
          </div>
          
          <div className="detail-catalog-list">
            {loading ? (
              <p style={{ padding: '15px', textAlign: 'center', color: 'var(--neutral-gray)' }}>Loading sensors…</p>
            ) : sensors.length === 0 ? (
              <p style={{ padding: '15px', textAlign: 'center', color: 'var(--neutral-gray)' }}>No sensors registered yet</p>
            ) : (
              sensors.map((sensor) => {
                const isSelected = selectedSensor?.id_sensor === sensor.id_sensor;
                return (
                  <button
                    key={sensor.id_sensor}
                    onClick={() => setSelectedSensor(sensor)}
                    className={`detail-list-item ${isSelected ? 'is-selected' : ''}`}
                  >
                    <div className="detail-list-item-top">
                      <span className={`detail-list-item-name ${isSelected ? 'is-selected' : ''}`}>
                        {sensor.serial_number}
                      </span>
                      <span className="detail-list-item-type">{sensor.description}</span>
                    </div>
                    <span className={`role-badge ${sensor.status} detail-list-item-badge`}>
                      {formatStatusLabel(sensor.status)}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT PANEL: SENSOR DETAIL */}
        {selectedSensor ? (
          <div className="detail-card card-sensors detail-content-card">
            <div className="detail-header">
              <div>
                <div className="detail-header-main">
                  <h2 className="detail-model-name">{selectedSensor.serial_number}</h2>
                  <span className="role-badge" style={{ marginLeft: '12px' }}>
                    {selectedSensor.description}
                  </span>
                </div>
                <p className="detail-model-type">{formatStatusLabel(selectedSensor.status)}</p>
              </div>
              <div className="detail-cta-wrap">
                <button 
                  className="btn-update"
                  onClick={() => setEditingSensor(selectedSensor)}
                >
                  Edit sensor
                </button>
                <button
                  className="btn-cancel"
                  onClick={() => confirmDelete(selectedSensor)}
                  style={{ marginLeft: '8px' }}
                >
                  Delete
                </button>
              </div>
            </div>

            <div className="detail-body">
              <div className="detail-grid">
                <div className="detail-card">
                  <label className="detail-label">Serial number</label>
                  <div className="detail-value">{selectedSensor.serial_number}</div>
                </div>

                <div className="detail-card">
                  <label className="detail-label">Model / Description</label>
                  <div className="detail-value">{selectedSensor.description}</div>
                </div>

                <div className="detail-card">
                  <label className="detail-label">Sampling rate</label>
                  <div className="detail-value">{selectedSensor.sampling_rate} Hz</div>
                </div>

                <div className="detail-card">
                  <label className="detail-label">Calibration date</label>
                  <div className="detail-value">{selectedSensor.calibration_date || 'Unknown'}</div>
                </div>
              </div>

              <div className="detail-section-block">
                <h4 className="card-title">Assigned placement</h4>
                {selectedSensor.id_machine ? (
                  <div className="detail-grid">
                    <div className="detail-card">
                      <label className="detail-label">Machine</label>
                      <div className="detail-value">{getMachineName(selectedSensor.id_machine)}</div>
                    </div>
                    <div className="detail-card">
                      <label className="detail-label">Position</label>
                      <div className="detail-value">{selectedSensor.position || '—'}</div>
                    </div>
                    <div className="detail-card">
                      <label className="detail-label">Channel</label>
                      <div className="detail-value">{selectedSensor.channel_no ?? '—'}</div>
                    </div>
                    <div className="detail-card">
                      <label className="detail-label">Module path</label>
                      <div className="detail-value"><code>{selectedSensor.module_path || '—'}</code></div>
                    </div>
                  </div>
                ) : (
                  <p style={{ color: 'var(--neutral-gray)' }}>Sensor in warehouse (unassigned)</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="detail-card card-sensors detail-content-card detail-empty">
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--neutral-gray)' }}>
              <p>Select a sensor from the list to view details</p>
            </div>
          </div>
        )}
      </div>

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

              <div className="detail-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="form-group">
                    <label>Channel selection</label>
                    <select
                        value={editingSensor.channel_no || ''}
                        onChange={(e) => setEditingSensor({...editingSensor, channel_no: e.target.value})}
                        disabled={!editingSensor.id_machine}
                    >
                        <option value="">-- Select channel --</option>
                        {CHANNEL_OPTIONS.map((ch) => (
                          <option key={ch} value={ch}>{ch}</option>
                        ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Module path</label>
                    <input
                        type="text"
                        value={editingSensor.module_path || ''}
                        onChange={(e) => setEditingSensor({...editingSensor, module_path: e.target.value})}
                        placeholder={DEFAULT_MODULE_PATH}
                        disabled={!editingSensor.id_machine}
                    />
                  </div>
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

      {/* MODAL: REGISTER NEW SENSOR */}
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content add-user-modal">
            <h2 className="modal-title-primary">New sensor</h2>
            <form onSubmit={handleAddSensor}>
              <div className="form-group form-group--validated">
                <label>Serial number *</label>
                <input
                  type="text"
                  value={newSensor.serial_number}
                  className={getAddInputClass('serial_number')}
                  onChange={(e) => setNewSensor({ ...newSensor, serial_number: e.target.value })}
                  onBlur={() => handleAddFieldBlur('serial_number')}
                  aria-invalid={Boolean(addTouched.serial_number && addErrors.serial_number)}
                  required
                />
                <small className="form-helper-text error" aria-live="polite">{addTouched.serial_number ? (addErrors.serial_number || ' ') : ' '}</small>
              </div>
              
              <div className="form-group">
                <label>Assign to machine (optional)</label>
                <select 
                    value={newSensor.id_machine} 
                    onChange={(e) => {
                      handleMachineChange(e, setNewSensor, newSensor);
                      setAddTouched((prev) => ({ ...prev, id_machine: true }));
                    }}
                    onBlur={() => handleAddFieldBlur('id_machine')}
                >
                    <option value="">-- Unassigned (Warehouse) --</option>
                    {machines.map(m => (
                        <option key={m.id_machine} value={m.id_machine}>{m.name}</option>
                    ))}
                </select>
              </div>

              {newSensor.id_machine && (
                  <>
                    <div className="detail-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                      <div className="form-group form-group--validated">
                        <label>Channel selection *</label>
                        <select
                          value={newSensor.channel_no}
                          className={getAddInputClass('channel_no')}
                          onChange={(e) => setNewSensor({ ...newSensor, channel_no: e.target.value })}
                          onBlur={() => handleAddFieldBlur('channel_no')}
                          aria-invalid={Boolean(addTouched.channel_no && addErrors.channel_no)}
                          required
                        >
                          <option value="">-- Select channel --</option>
                          {CHANNEL_OPTIONS.map((ch) => (
                            <option key={ch} value={ch}>{ch}</option>
                          ))}
                        </select>
                        <small className="form-helper-text error" aria-live="polite">{addTouched.channel_no ? (addErrors.channel_no || ' ') : ' '}</small>
                      </div>
                      <div className="form-group form-group--validated">
                        <label>Module path *</label>
                        <input 
                          type="text"
                          placeholder={DEFAULT_MODULE_PATH}
                          value={newSensor.module_path}
                          className={getAddInputClass('module_path')}
                          onChange={(e) => setNewSensor({ ...newSensor, module_path: e.target.value })}
                          onBlur={() => handleAddFieldBlur('module_path')}
                          aria-invalid={Boolean(addTouched.module_path && addErrors.module_path)}
                          required
                        />
                        <small className="form-helper-text error" aria-live="polite">{addTouched.module_path ? (addErrors.module_path || ' ') : ' '}</small>
                      </div>
                    </div>

                    <div className="form-group form-group--validated">
                      <label>Machine position *</label>
                      <input 
                          type="text" 
                          placeholder="e.g. Bearing 1" 
                          value={newSensor.position}
                          className={getAddInputClass('position')}
                          onChange={(e) => setNewSensor({ ...newSensor, position: e.target.value })}
                          onBlur={() => handleAddFieldBlur('position')}
                          aria-invalid={Boolean(addTouched.position && addErrors.position)}
                          required
                      />
                      <small className="form-helper-text error" aria-live="polite">{addTouched.position ? (addErrors.position || ' ') : ' '}</small>
                    </div>
                  </>
              )}

              <div className="form-group form-group--validated">
                <label>Description *</label>
                <input
                  type="text"
                  value={newSensor.description}
                  className={getAddInputClass('description')}
                  onChange={(e) => setNewSensor({ ...newSensor, description: e.target.value })}
                  onBlur={() => handleAddFieldBlur('description')}
                  aria-invalid={Boolean(addTouched.description && addErrors.description)}
                  required
                />
                <small className="form-helper-text error" aria-live="polite">{addTouched.description ? (addErrors.description || ' ') : ' '}</small>
              </div>
              
              <div className="detail-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group form-group--validated">
                    <label>Sampling Rate (Hz)</label>
                    <input
                      type="number"
                      value={newSensor.sampling_rate}
                      className={getAddInputClass('sampling_rate')}
                      onChange={(e) => setNewSensor({ ...newSensor, sampling_rate: e.target.value })}
                      onBlur={() => handleAddFieldBlur('sampling_rate')}
                      aria-invalid={Boolean(addTouched.sampling_rate && addErrors.sampling_rate)}
                    />
                    <small className="form-helper-text error" aria-live="polite">{addTouched.sampling_rate ? (addErrors.sampling_rate || ' ') : ' '}</small>
                </div>
                <div className="form-group form-group--validated">
                    <label>Calibration</label>
                    <input
                      type="date"
                      value={newSensor.calibration_date}
                      className={getAddInputClass('calibration_date')}
                      onChange={(e) => setNewSensor({ ...newSensor, calibration_date: e.target.value })}
                      onBlur={() => handleAddFieldBlur('calibration_date')}
                      aria-invalid={Boolean(addTouched.calibration_date && addErrors.calibration_date)}
                    />
                    <small className="form-helper-text error" aria-live="polite">{addTouched.calibration_date ? (addErrors.calibration_date || ' ') : ' '}</small>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setAddTouched({});
                    setAddErrors({});
                    setAddLiveValidation({});
                  }}
                >
                  Cancel
                </button>
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