import { useState, useEffect } from 'react';
import axios from 'axios';
import MachineCard from '../components/MachineCard';

function Dashboard({ token }) {
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMachines = async () => {
      try {
        setLoading(true);
        const res = await axios.get('http://127.0.0.1:8000/machines', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMachines(res.data);
      } catch (err) {
        console.error("Chyba při načítání dashboardu", err);
      } finally {
        setLoading(false);
      }
    };

    if (token) fetchMachines();
  }, [token]);

  if (loading) return <div className="page-container">Načítám dashboard...</div>;

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px' }}>
        <h2 style={{ margin: 0, color: 'var(--text-main)' }}>
          <span style={{ color: '#E4002B' }}>Provozní</span> Dashboard
        </h2>
        <span style={{ fontSize: '0.9rem', color: '#64748b' }}>Celkem strojů: {machines.length}</span>
      </div>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', // Kompaktnější šířka
        gap: '20px',
        alignItems: 'stretch' // Aby karty měly stejnou výšku v řádku
      }}>
        {machines.map(m => (
          <MachineCard key={m.id_machine} machine={m} />
        ))}
      </div>
    </div>
  );
}

export default Dashboard;