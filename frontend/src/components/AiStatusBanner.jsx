import { useState, useEffect } from 'react';
import axios from 'axios';

const AiIcon = () => (
  <svg className="ai-banner-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9.5 2A2.5 2.5 0 0112 4.5v15a2.5 2.5 0 01-5 0v-15A2.5 2.5 0 019.5 2z"/>
    <path d="M14.5 8A2.5 2.5 0 0117 10.5v9a2.5 2.5 0 01-5 0v-9A2.5 2.5 0 0114.5 8z"/>
    <path d="M4.5 13A2.5 2.5 0 017 15.5v4a2.5 2.5 0 01-5 0v-4A2.5 2.5 0 014.5 13z"/>
  </svg>
);

function formatDate(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return ts; }
}

function AiStatusBanner({ machineId }) {
  const [aiData, setAiData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAiData = async () => {
      try {
        const token = sessionStorage.getItem('token') || localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.get(`/machines/${machineId}/latest-ai`, { headers });
        setAiData(res.data);
      } catch (err) {
        console.error('AI data fetch error for machine', machineId);
      } finally {
        setLoading(false);
      }
    };
    fetchAiData();
  }, [machineId]);

  if (loading) {
    return <div className="ai-banner ai-banner--loading">Loading AI diagnostics…</div>;
  }

  const hasData = aiData && (aiData.anomaly?.timestamp || aiData.fault?.timestamp || aiData.rul?.timestamp);

  if (!hasData) {
    return (
      <div className="ai-banner ai-banner--empty">
        No AI analysis run yet
      </div>
    );
  }

  const timestamps = [aiData.anomaly?.timestamp, aiData.fault?.timestamp, aiData.rul?.timestamp].filter(Boolean);
  const latestDate = [...timestamps].sort().reverse()[0];

  const isAnomalyDetected = aiData.anomaly?.label === 'Anomaly detected';
  const isFaultClassified = aiData.fault?.label && !aiData.fault.label.toLowerCase().includes('zdrav');
  const isError = isAnomalyDetected || isFaultClassified;

  return (
    <div className={`ai-banner ${isError ? 'ai-banner--error' : 'ai-banner--ok'}`}>
      <div className="ai-banner-header">
        <div className="ai-banner-header-left">
          <AiIcon />
          <span className="ai-banner-title">AI Diagnostics</span>
        </div>
        <span className="ai-banner-timestamp">{formatDate(latestDate)}</span>
      </div>

      <div className="ai-banner-metrics">
        {aiData.anomaly?.timestamp && (
          <div className="ai-metric">
            <span className="ai-metric-label">Anomaly</span>
            <span className={`ai-metric-value ${isAnomalyDetected ? 'ai-metric-value--bad' : 'ai-metric-value--good'}`}>
              {isAnomalyDetected ? 'Detected' : 'None'}
              <span className="ai-metric-confidence">({aiData.anomaly.value?.toFixed(2)})</span>
            </span>
          </div>
        )}

        {aiData.fault?.timestamp && (
          <div className="ai-metric">
            <span className="ai-metric-label">Fault class</span>
            <span className={`ai-metric-value ${isFaultClassified ? 'ai-metric-value--bad' : 'ai-metric-value--good'}`}>
              {aiData.fault.label}
              <span className="ai-metric-confidence">({(aiData.fault.confidence * 100).toFixed(0)}%)</span>
            </span>
          </div>
        )}

        <div className="ai-metric">
          <span className="ai-metric-label">RUL estimate</span>
          {aiData.rul?.timestamp
            ? <span className="ai-metric-value ai-metric-value--rul">{aiData.rul.value} days</span>
            : <span className="ai-metric-value ai-metric-value--muted">Not run</span>
          }
        </div>
      </div>
    </div>
  );
}

export default AiStatusBanner;