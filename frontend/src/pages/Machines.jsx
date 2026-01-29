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
            const response = await axios.get('http://127.0.0.1:8000/machines');
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
            await axios.post('http://127.0.0.1:8000/machines', newMachine);
            
            // Reset formuláře a zavření modalu
            setIsAddModalOpen(false);
            setNewMachine({ name: '', description: '', type: '', location: '', status: 'OK' });
            
            // Obnovení seznamu
            fetchMachines();
        } catch (error) {
            alert("Chyba při přidávání stroje: " + (error.response?.data?.detail || error.message));
        }
    };

    return (
        <div className="page-container">
            <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ color: 'var(--text)', margin: 0 }}>Přehled strojů</h2>
                <button className="btn-diagnose" onClick={() => setIsAddModalOpen(true)}>
                    + Přidat stroj
                </button>
            </div>

            <div className="table-wrapper">
                {loading ? (
                    <p style={{ padding: '20px' }}>Načítám seznam strojů...</p>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>Název stroje</th>
                                <th>Typ</th>
                                <th>Lokace</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'center' }}>Akce</th>
                            </tr>
                        </thead>
                        <tbody>
                            {machines.map((machine) => (
                                <tr key={machine.id_machine}>
                                    <td>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                            <span style={{ fontWeight: 'bold', color: 'var(--text)' }}>{machine.name}</span>
                                            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>ID: {machine.id_machine}</span>
                                        </div>
                                    </td>
                                    <td>{machine.type}</td>
                                    <td>{machine.location}</td>
                                    <td>
                                        <span className={`role-badge ${machine.status}`}>
                                            {machine.status}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <button 
                                            className="btn-small-edit" 
                                            onClick={() => handleOpenDetail(machine.id_machine)}
                                        >
                                            Detail & Diagnostika
                                        </button>
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
                        <h2 style={{ color: 'var(--br-orange)', marginBottom: '20px' }}>Nový stroj</h2>
                        <form onSubmit={handleAddMachine}>
                            <div className="form-group">
                                <label>Název stroje *</label>
                                <input 
                                    type="text" 
                                    value={newMachine.name}
                                    onChange={(e) => setNewMachine({...newMachine, name: e.target.value})}
                                    placeholder="Např. CNC Frézka 01"
                                    required 
                                />
                            </div>

                            <div className="form-group">
                                <label>Popis *</label>
                                <input 
                                    type="text" 
                                    value={newMachine.description}
                                    onChange={(e) => setNewMachine({...newMachine, description: e.target.value})}
                                    placeholder="Zde zadejte popis stroje"
                                    required 
                                />
                            </div>

                            <div className="form-group">
                                <label>Typ zařízení *</label>
                                <input 
                                    type="text" 
                                    value={newMachine.type}
                                    onChange={(e) => setNewMachine({...newMachine, type: e.target.value})}
                                    placeholder="Např. Frézka, Lis, Kompresor..."
                                    required 
                                />
                            </div>

                            <div className="form-group">
                                <label>Lokace / Umístění *</label>
                                <input 
                                    type="text" 
                                    value={newMachine.location}
                                    onChange={(e) => setNewMachine({...newMachine, location: e.target.value})}
                                    placeholder="Např. Hala A, Linka 3"
                                    required 
                                />
                            </div>

                            <div className="form-group">
                                <label>Počáteční status</label>
                                <select 
                                    value={newMachine.status} 
                                    onChange={(e) => setNewMachine({...newMachine, status: e.target.value})}
                                >
                                    <option value="OK">OK (V pořádku)</option>
                                    <option value="WARNING">WARNING (Varování)</option>
                                    <option value="CRITICAL">CRITICAL (Kritický)</option>
                                    <option value="OFFLINE">OFFLINE (Vypnuto)</option>
                                </select>
                            </div>

                            <div className="modal-actions" style={{ marginTop: '30px' }}>
                                <button type="button" className="btn-cancel" onClick={() => setIsAddModalOpen(false)}>Zrušit</button>
                                <button type="submit" className="btn-add-confirm">Přidat stroj</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Machines;