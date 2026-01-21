import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function Machines() {
    // Variables
    const [machines, setMachines] = useState([]);
    const [loading, setLoading] = useState(true);
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

    return (
        <div className="page-container">
            <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ color: 'var(--text)', margin: 0 }}>Přehled strojů</h2>
                {/* Tlačítko zatím jen vizuální, modal doděláme později */}
                <button className="btn-diagnose" onClick={() => alert("Přidávání strojů implementujeme v dalším kroku")}>
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
            </div>
    );
}

export default Machines;