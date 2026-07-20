import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import MachineCard from '../components/MachineCard';
import PageTitle from '../components/PageTitle';

function normalizeMachinesPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.machines)) return payload.machines;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function formatRelativeTime(iso) {
  if (!iso) return null;

  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return null;

  const diffMs = Date.now() - ts;
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} h ago`;

  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} d ago`;
}

function Dashboard({ token }) {
  const navigate = useNavigate();
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [collectionHealth, setCollectionHealth] = useState(null);

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

  useEffect(() => {
    if (!token) {
      setCollectionHealth(null);
      return;
    }

    let mounted = true;

    const fetchCollectionHealth = async () => {
      try {
        const res = await axios.get('/collection/health', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (mounted) {
          setCollectionHealth(res.data || null);
        }
      } catch (err) {
        if (mounted) {
          setCollectionHealth({
            scheduler_running: false,
            last_error: err.response?.data?.detail || err.message || 'Collection health unavailable'
          });
        }
      }
    };

    fetchCollectionHealth();
    const intervalId = setInterval(fetchCollectionHealth, 45000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [token]);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    setRefreshKey(prev => prev + 1);
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="skeleton-grid" role="status" aria-label="Loading machines">
          {Array.from({ length: 6 }).map((_, i) => (
            <div className="skeleton-card" key={i} aria-hidden="true">
              <div className="skeleton-block skeleton-block--title" />
              <div className="skeleton-block skeleton-block--subtitle" />
              <div className="skeleton-block skeleton-block--banner" />
              <div className="skeleton-block skeleton-block--graph" />
              <div className="skeleton-block skeleton-block--note" />
              <div className="skeleton-block skeleton-block--actions" />
            </div>
          ))}
          <span className="sr-only">Loading machines…</span>
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
          <button type="button" className="btn-diagnose empty-state-cta" onClick={() => navigate('/machines')}>
            + Add machine
          </button>
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

  const nowTs = Date.now();
  const lastSuccessTs = collectionHealth?.last_successful_collection_at
    ? new Date(collectionHealth.last_successful_collection_at).getTime()
    : null;
  const isRecentSuccess = Boolean(lastSuccessTs) && (nowTs - lastSuccessTs <= 6 * 60 * 60 * 1000);

  let healthTone = 'muted';
  let healthLabel = 'Waiting';
  let healthSubtext = 'Awaiting first successful run';

  const relativeLastSuccess = formatRelativeTime(collectionHealth?.last_successful_collection_at);

  if (collectionHealth?.last_error) {
    healthTone = 'error';
    healthLabel = 'Error';
    healthSubtext = 'Collector error detected. Check backend logs.';
  } else if (collectionHealth?.scheduler_running === false) {
    healthTone = 'error';
    healthLabel = 'Stopped';
    healthSubtext = 'Scheduler is disabled.';
  } else if (collectionHealth?.scheduler_running && isRecentSuccess) {
    healthTone = 'ok';
    healthLabel = 'Healthy';
    healthSubtext = relativeLastSuccess ? `Last success ${relativeLastSuccess}` : 'Running on schedule.';
  } else if (collectionHealth?.scheduler_running) {
    healthTone = 'warn';
    healthLabel = 'Stale';
    healthSubtext = relativeLastSuccess ? `Last success ${relativeLastSuccess}` : 'No successful collection yet.';
  }

  const healthHint = collectionHealth?.last_successful_collection_at
    ? `Last success ${new Date(collectionHealth.last_successful_collection_at).toLocaleString('en-GB')}`
    : 'No successful collection recorded yet';

  return (
    <div className="page-container">
      <PageTitle 
        title="Fleet Overview"
        subtitle="Live machinery status, vibration trends and AI diagnostic signals across the plant."
      />
      
      <div className="dashboard-summary-card" aria-live="polite" role="status" aria-label="Machine fleet status">
        <div className="dashboard-summary-grid">
          <div className="dashboard-stat-box">
            <div className="dashboard-stat-number" style={{ color: summary.ok > 0 ? 'var(--status-ok)' : 'var(--neutral-gray)' }}>
              {summary.ok}
            </div>
            <div className="dashboard-stat-label">
              <span className="dashboard-stat-indicator dashboard-stat-indicator--ok" aria-hidden="true"></span>
              OK
            </div>
          </div>

          <div className="dashboard-stat-box">
            <div className="dashboard-stat-number" style={{ color: summary.warning > 0 ? 'var(--status-warning)' : 'var(--neutral-gray)' }}>
              {summary.warning}
            </div>
            <div className="dashboard-stat-label">
              <span className="dashboard-stat-indicator dashboard-stat-indicator--warning" aria-hidden="true"></span>
              Warning
            </div>
          </div>

          <div className="dashboard-stat-box">
            <div className="dashboard-stat-number" style={{ color: summary.fault > 0 ? 'var(--status-fault)' : 'var(--neutral-gray)' }}>
              {summary.fault}
            </div>
            <div className="dashboard-stat-label">
              <span className="dashboard-stat-indicator dashboard-stat-indicator--fault" aria-hidden="true"></span>
              Fault
            </div>
          </div>

          <div className="dashboard-stat-box">
            <div className="dashboard-stat-number">{machines.length}</div>
            <div className="dashboard-stat-label">Total Machines</div>
          </div>

          <div className={`dashboard-stat-box dashboard-stat-box--collection dashboard-stat-box--collection-${healthTone}`}
            aria-label={`Collection ${healthLabel}. ${healthSubtext}`}
            title={collectionHealth?.last_error ? `${healthHint}. Error: ${collectionHealth.last_error}` : healthHint}
          >
            <div className="dashboard-stat-number dashboard-stat-collection-status">{healthLabel}</div>
            <div className="dashboard-stat-label">
              <span className={`dashboard-stat-indicator dashboard-stat-indicator--collection-${healthTone}`} aria-hidden="true"></span>
              Collection
            </div>
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