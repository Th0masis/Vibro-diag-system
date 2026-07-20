import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/ToastProvider';
import { useValidationState } from '../utils/validation';
import PageTitle from '../components/PageTitle';

function normalizeListPayload(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.machines)) return payload.machines;
    return [];
}

function Machines() {
    const toast = useToast();
    // Variables
    const [machines, setMachines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [selectedMachine, setSelectedMachine] = useState(null);
    
    // State pro nový stroj
    const [newMachine, setNewMachine] = useState({
        name: '',
        description: '',
        type: '',
        location: '',
        status: 'OK'
    });

    const validateMachineField = (field, value) => {
        const v = String(value || '').trim();
        if (field === 'name') return v ? '' : 'Machine name is required.';
        if (field === 'description') return v ? '' : 'Description is required.';
        if (field === 'type') return v ? '' : 'Device type is required.';
        if (field === 'location') return v ? '' : 'Location is required.';
        return '';
    };

    const {
        touched,
        errors,
        onBlurField,
        onChangeField,
        validateForm,
        getInputClass,
        clearValidation,
    } = useValidationState(validateMachineField);

    const navigate = useNavigate();

    // Functions
    const fetchMachines = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/machines');
            setMachines(normalizeListPayload(response.data));
        } catch (error) {
            console.error("Couldn't load machines:", error);
            setMachines([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMachines();
    }, []);

    const handleOpenDetail = (id) => {
        navigate(`/machines/${id}`);
    };

    // Handler pro přidání stroje
    const handleAddMachine = async (e) => {
        e.preventDefault();

        if (!validateForm(['name', 'description', 'type', 'location'], newMachine)) {
            toast.warning('Please fix highlighted fields before adding machine.');
            return;
        }

        try {
            await axios.post('/machines', newMachine);
            
            // Reset formuláře a zavření modalu
            setIsAddModalOpen(false);
            setNewMachine({ name: '', description: '', type: '', location: '', status: 'OK' });
            clearValidation();
            
            // Obnovení seznamu
            fetchMachines();
            toast.success('Machine added successfully.');
        } catch (error) {
            toast.error('Failed to add machine: ' + (error.response?.data?.detail || error.message));
        }
    };

    return (
        <div className="page-container">
            <PageTitle title="Machines">
                <button className="btn-diagnose" onClick={() => setIsAddModalOpen(true)}>
                    + Add machine
                </button>
            </PageTitle>

            <div className="detail-layout">
                {/* LEFT PANEL: MACHINE LIST */}
                <div className="detail-card card-tech detail-catalog-card">
                  <div className="detail-catalog-header">
                    <h3 className="card-title detail-catalog-title">Machine fleet</h3>
                    <span className="detail-catalog-count">{machines.length}</span>
                  </div>
                  
                  <div className="detail-catalog-list">
                    {loading ? (
                      <p style={{ padding: '15px', textAlign: 'center', color: 'var(--neutral-gray)' }}>Loading machines…</p>
                    ) : machines.length === 0 ? (
                      <p style={{ padding: '15px', textAlign: 'center', color: 'var(--neutral-gray)' }}>No machines registered yet</p>
                    ) : (
                      machines.map((machine) => {
                        const isSelected = selectedMachine?.id_machine === machine.id_machine;
                        return (
                          <button
                            key={machine.id_machine}
                            onClick={() => setSelectedMachine(machine)}
                            className={`detail-list-item ${isSelected ? 'is-selected' : ''}`}
                          >
                            <div className="detail-list-item-top">
                              <span className={`detail-list-item-name ${isSelected ? 'is-selected' : ''}`}>
                                {machine.name}
                              </span>
                              <span className="detail-list-item-type">{machine.type} • {machine.location}</span>
                            </div>
                            <span className={`role-badge ${machine.status} detail-list-item-badge`}>
                              {machine.status}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* RIGHT PANEL: MACHINE PREVIEW */}
                {selectedMachine ? (
                  <div className="detail-card card-sensors detail-content-card">
                    <div className="detail-header">
                      <div>
                        <div className="detail-header-main">
                          <h2 className="detail-model-name">{selectedMachine.name}</h2>
                          <span className={`role-badge ${selectedMachine.status}`} style={{ marginLeft: '12px' }}>
                            {selectedMachine.status}
                          </span>
                        </div>
                        <p className="detail-model-type">{selectedMachine.type}</p>
                      </div>
                      <div className="detail-cta-wrap">
                        <button 
                          className="btn-update"
                          onClick={() => handleOpenDetail(selectedMachine.id_machine)}
                        >
                          Full details
                        </button>
                      </div>
                    </div>

                    <div className="detail-body">
                      <div className="detail-grid">
                        <div className="detail-card">
                          <label className="detail-label">Machine ID</label>
                          <div className="detail-value">#{selectedMachine.id_machine}</div>
                        </div>

                        <div className="detail-card">
                          <label className="detail-label">Type</label>
                          <div className="detail-value">{selectedMachine.type}</div>
                        </div>

                        <div className="detail-card">
                          <label className="detail-label">Location</label>
                          <div className="detail-value">{selectedMachine.location}</div>
                        </div>

                        <div className="detail-card">
                          <label className="detail-label">Status</label>
                          <div className="detail-value">{selectedMachine.status}</div>
                        </div>
                      </div>

                      <div className="detail-section-block">
                        <h4 className="card-title">Description</h4>
                        <p style={{ margin: '0.5rem 0 0', color: 'var(--text-secondary)' }}>
                          {selectedMachine.description || 'No description provided'}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="detail-card card-sensors detail-content-card detail-empty">
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--neutral-gray)' }}>
                      <p>Select a machine from the list to view details</p>
                    </div>
                  </div>
                )}
              </div>

            {/* MODAL: PŘIDÁNÍ STROJE */}
            {isAddModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content add-user-modal">
                        <h2 style={{ color: 'var(--primary)', marginBottom: '20px' }}>New machine</h2>
                        <form onSubmit={handleAddMachine}>
                            <div className="form-group">
                                <label>Machine name *</label>
                                <input 
                                    type="text" 
                                    value={newMachine.name}
                                    className={getInputClass('name', newMachine.name)}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        const next = { ...newMachine, name: value };
                                        setNewMachine(next);
                                        onChangeField('name', value, next);
                                    }}
                                    onBlur={() => onBlurField('name', newMachine.name, newMachine)}
                                    aria-invalid={Boolean(touched.name && errors.name)}
                                    placeholder="e.g. CNC Mill 01"
                                    required 
                                />
                                <small className="form-helper-text error" aria-live="polite">{touched.name ? (errors.name || ' ') : ' '}</small>
                            </div>

                            <div className="form-group">
                                <label>Description *</label>
                                <input 
                                    type="text" 
                                    value={newMachine.description}
                                    className={getInputClass('description', newMachine.description)}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        const next = { ...newMachine, description: value };
                                        setNewMachine(next);
                                        onChangeField('description', value, next);
                                    }}
                                    onBlur={() => onBlurField('description', newMachine.description, newMachine)}
                                    aria-invalid={Boolean(touched.description && errors.description)}
                                    placeholder="Enter machine description"
                                    required 
                                />
                                <small className="form-helper-text error" aria-live="polite">{touched.description ? (errors.description || ' ') : ' '}</small>
                            </div>

                            <div className="form-group">
                                <label>Device type *</label>
                                <input 
                                    type="text" 
                                    value={newMachine.type}
                                    className={getInputClass('type', newMachine.type)}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        const next = { ...newMachine, type: value };
                                        setNewMachine(next);
                                        onChangeField('type', value, next);
                                    }}
                                    onBlur={() => onBlurField('type', newMachine.type, newMachine)}
                                    aria-invalid={Boolean(touched.type && errors.type)}
                                    placeholder="e.g. Mill, Press, Compressor"
                                    required 
                                />
                                <small className="form-helper-text error" aria-live="polite">{touched.type ? (errors.type || ' ') : ' '}</small>
                            </div>

                            <div className="form-group">
                                <label>Location *</label>
                                <input 
                                    type="text" 
                                    value={newMachine.location}
                                    className={getInputClass('location', newMachine.location)}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        const next = { ...newMachine, location: value };
                                        setNewMachine(next);
                                        onChangeField('location', value, next);
                                    }}
                                    onBlur={() => onBlurField('location', newMachine.location, newMachine)}
                                    aria-invalid={Boolean(touched.location && errors.location)}
                                    placeholder="e.g. Hall A, Line 3"
                                    required 
                                />
                                <small className="form-helper-text error" aria-live="polite">{touched.location ? (errors.location || ' ') : ' '}</small>
                            </div>

                            <div className="form-group">
                                <label>Initial status</label>
                                <select 
                                    value={newMachine.status} 
                                    onChange={(e) => setNewMachine({...newMachine, status: e.target.value})}
                                >
                                    <option value="OK">OK</option>
                                    <option value="WARNING">WARNING</option>
                                    <option value="FAULT">FAULT</option>
                                    <option value="STOPPED">STOPPED</option>
                                </select>
                            </div>

                            <div className="modal-actions" style={{ marginTop: '30px' }}>
                                <button type="button" className="btn-cancel" onClick={() => { setIsAddModalOpen(false); clearValidation(); }}>Cancel</button>
                                <button type="submit" className="btn-add-confirm">Add machine</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Machines;