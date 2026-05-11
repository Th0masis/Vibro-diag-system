import { useState, useEffect } from 'react';
import axios from 'axios';
import MachineCard from '../components/MachineCard';
import MeasurementDetailModal from '../components/MeasurementDetailModal'; // 1. Import Modalu ZDE

function Dashboard({ token }) {
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // 2. Stav pro modal je nyní v Dashboardu (na úrovni celé stránky)
  const [selectedMeasurementId, setSelectedMeasurementId] = useState(null);

  useEffect(() => {
    const fetchMachines = async () => {
      try {
        setLoading(true);
        const res = await axios.get('/machines', {
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
        gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', 
        gap: '20px',
        alignItems: 'stretch' 
      }}>
        {machines.map(m => (
          <MachineCard 
            key={m.id_machine} 
            machine={m} 
            // 3. Předáváme funkci pro otevření modalu do karty
            onOpenDetail={(id) => setSelectedMeasurementId(id)}
          />
        ))}
      </div>

      {/* 4. Modal se vykresluje TADY, nezávisle na kartách */}
      {selectedMeasurementId && (
        <MeasurementDetailModal 
          measurementId={selectedMeasurementId} 
          onClose={() => setSelectedMeasurementId(null)} 
        />
      )}
    </div>
  );
}

export default Dashboard;