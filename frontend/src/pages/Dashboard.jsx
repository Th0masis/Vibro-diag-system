import { useState, useEffect } from 'react';
import axios from 'axios';
import MachineCard from '../components/MachineCard';

function normalizeMachinesPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.machines)) return payload.machines;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function Dashboard({ token }) {
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchMachines = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await axios.get('/machines', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMachines(normalizeMachinesPayload(res.data));
      } catch (err) {
        console.error("Chyba při načítání dashboardu", err);
        setError(err.response?.data?.message || "Failed to load machines. Please try again.");
        setMachines([]);
      } finally {
        setLoading(false);
      }
    };

    if (token) fetchMachines();
  }, [token, refreshKey]);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    setRefreshKey(prev => prev + 1);
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-message">
          <span className="loading-spinner" aria-hidden="true"></span>
          <span>Loading machines…</span>
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
          <div className="empty-state-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>
          </div>
          <h2 className="empty-state-title">No machines yet</h2>
          <p className="empty-state-description">
            Add a machine to start collecting vibration data and running AI diagnostics.
          </p>
        </div>
      </div>
    );
  }

  const summary = machines.reduce(
    (acc, m) => {
      const status = (m.status || '').toUpperCase();
      if (status === 'OK') acc.ok += 1;
      else if (status === 'WARNING') acc.warning += 1;
      else acc.fault += 1;
      return acc;
    },
    { ok: 0, warning: 0, fault: 0 }
  );

  return (
    <div className="page-container">
      <div className="dashboard-pro-header">
        <div className="dashboard-pro-title-block">
          <h1 className="dashboard-pro-title">Fleet Overview</h1>
          <p className="dashboard-pro-subtitle">Live machinery status, vibration trends and AI diagnostic signals across the plant.</p>
        </div>
        <div className="dashboard-pro-summary" aria-live="polite" role="status" aria-label="Machine fleet status">
          <div className="status-stat">
            <span className="status-stat-dot status-stat-dot--ok" aria-hidden="true"></span>
            <strong className="status-stat-count" style={summary.ok > 0 ? {color:'#059669'} : undefined}>{summary.ok}</strong>
            <span className="status-stat-label">OK</span>
          </div>
          <span className="status-stat-divider" aria-hidden="true"></span>
          <div className="status-stat">
            <span className="status-stat-dot status-stat-dot--warning" aria-hidden="true"></span>
            <strong className="status-stat-count" style={summary.warning > 0 ? {color:'#B45309'} : undefined}>{summary.warning}</strong>
            <span className="status-stat-label">Warning</span>
          </div>
          <span className="status-stat-divider" aria-hidden="true"></span>
          <div className="status-stat">
            <span className="status-stat-dot status-stat-dot--fault" aria-hidden="true"></span>
            <strong className="status-stat-count" style={summary.fault > 0 ? {color:'#DC2626'} : undefined}>{summary.fault}</strong>
            <span className="status-stat-label">Fault</span>
          </div>
          <span className="status-stat-divider" aria-hidden="true"></span>
          <div className="status-stat">
            <strong className="status-stat-count">{machines.length}</strong>
            <span className="status-stat-label">Total</span>
          </div>
        </div>
      </div>
      
      <div className="dashboard-pro-grid" role="region" aria-label="Machine status cards">
        {machines.map(m => (
          <MachineCard 
            key={m.id_machine} 
            machine={m}
          />
        ))}
      </div>
    </div>
  );
}

export default Dashboard;