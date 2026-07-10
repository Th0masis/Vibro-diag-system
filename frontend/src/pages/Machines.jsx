import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function Machines() {
    // Variables
    const [machines, setMachines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    
    // State pro nový stroj
    const [newMachine, setNewMachine] = useState({
        name: '',
        description: '',
        type: '',
        location: '',
        status: 'OK'
    });

    const navigate = useNavigate();

    // Functions
    const fetchMachines = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/machines');
            setMachines(response.data);
        } catch (error) {
            console.error("Couldn't load machines:", error);
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
        try {
            await axios.post('/machines', newMachine);
            
            // Reset formuláře a zavření modalu
            setIsAddModalOpen(false);
            setNewMachine({ name: '', description: '', type: '', location: '', status: 'OK' });
            
            // Obnovení seznamu
            fetchMachines();
        } catch (error) {
            alert('Failed to add machine: ' + (error.response?.data?.detail || error.message));
        }
    };

    return (
        <div className="page-container">
            <div className="section-header section-header-row">
                <h2 className="section-header-title">Machines</h2>
                <button className="btn-diagnose" onClick={() => setIsAddModalOpen(true)}>
                    + Add machine
                </button>
            </div>

            <div className="table-wrapper">
                {loading ? (
                    <p style={{ padding: '20px' }}>Loading machines…</p>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>Machine name</th>
                                <th>Type</th>
                                <th>Location</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {machines.map((machine) => (
                                <tr key={machine.id_machine}>
                                    <td>
                                        <div className="machine-id-stack">
                                            <span className="machine-id-name">{machine.name}</span>
                                            <span className="machine-id-meta">ID: {machine.id_machine}</span>
                                        </div>
                                    </td>
                                    <td>{machine.type}</td>
                                    <td>{machine.location}</td>
                                    <td>
                                        <span className={`role-badge ${machine.status}`}>
                                            {machine.status}
                                        </span>
                                    </td>
                                    <td className="table-actions-center">
                                        <div className="machine-sensors-actions-wrap">
                                            <button
                                                className="sensor-btn sensor-btn-detail"
                                                onClick={() => handleOpenDetail(machine.id_machine)}
                                                title="Open machine detail"
                                                aria-label="Open machine detail"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
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
                                    onChange={(e) => setNewMachine({...newMachine, name: e.target.value})}
                                    placeholder="e.g. CNC Mill 01"
                                    required 
                                />
                            </div>

                            <div className="form-group">
                                <label>Description *</label>
                                <input 
                                    type="text" 
                                    value={newMachine.description}
                                    onChange={(e) => setNewMachine({...newMachine, description: e.target.value})}
                                    placeholder="Enter machine description"
                                    required 
                                />
                            </div>

                            <div className="form-group">
                                <label>Device type *</label>
                                <input 
                                    type="text" 
                                    value={newMachine.type}
                                    onChange={(e) => setNewMachine({...newMachine, type: e.target.value})}
                                    placeholder="e.g. Mill, Press, Compressor"
                                    required 
                                />
                            </div>

                            <div className="form-group">
                                <label>Location *</label>
                                <input 
                                    type="text" 
                                    value={newMachine.location}
                                    onChange={(e) => setNewMachine({...newMachine, location: e.target.value})}
                                    placeholder="e.g. Hall A, Line 3"
                                    required 
                                />
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
                                <button type="button" className="btn-cancel" onClick={() => setIsAddModalOpen(false)}>Cancel</button>
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