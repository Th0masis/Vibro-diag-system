import { useState, useEffect } from 'react';
import axios from 'axios';
import MachineCard from '../components/MachineCard';
import MeasurementDetailModal from '../components/MeasurementDetailModal'; // 1. Import Modalu ZDE

function Dashboard({ token }) {
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // 2. Stav pro modal je nyní v Dashboardu (na úrovni celé stránky)
  const [selectedMeasurementId, setSelectedMeasurementId] = useState(null);

  useEffect(() => {
    const fetchMachines = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await axios.get('/machines', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMachines(res.data);
      } catch (err) {
        console.error("Chyba při načítání dashboardu", err);
        setError(err.response?.data?.message || "Failed to load machines. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    if (token) fetchMachines();
  }, [token]);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-message">
          <span className="loading-spinner" aria-hidden="true"></span>
          <span>Loading machinery diagnostics dashboard...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="error-message" role="alert">
          <div>
            <p><strong>Unable to load dashboard</strong></p>
            <p>{error}</p>
          </div>
          <button onClick={handleRetry} aria-label="Retry loading machines">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (machines.length === 0) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <h2 className="empty-state-title">No machines registered</h2>
          <p className="empty-state-description">
            Once machinery is registered and connected, their status and diagnostics will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px' }}>
        <h1 style={{ margin: 0, color: 'var(--text-main)' }}>
          <span style={{ color: '#E4002B' }}>Operational</span> Dashboard
        </h1>
        <span style={{ fontSize: '0.9rem', color: '#64748b' }} aria-live="polite">
          Total machines: <strong>{machines.length}</strong>
        </span>
      </div>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', 
        gap: '20px',
        alignItems: 'stretch' 
      }} role="region" aria-label="Machine status cards">
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