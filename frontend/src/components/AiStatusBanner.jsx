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
    const date = parseTimestamp(ts);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return ts; }
}

function parseTimestamp(ts) {
  if (ts == null) return new Date(NaN);

  if (ts instanceof Date) return ts;

  if (typeof ts === 'number') {
    const value = ts < 1e12 ? ts * 1000 : ts;
    return new Date(value);
  }

  if (typeof ts === 'string') {
    const trimmed = ts.trim();

    // Backend format: dd.mm.yyyy HH:MM
    const czechMatch = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?$/);
    if (czechMatch) {
      const [, dd, mm, yyyy, hh = '00', mi = '00'] = czechMatch;
      return new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(mi));
    }

    if (/^\d+$/.test(trimmed)) {
      const asNumber = Number(trimmed);
      const value = trimmed.length <= 10 ? asNumber * 1000 : asNumber;
      return new Date(value);
    }

    return new Date(trimmed);
  }

  return new Date(ts);
}

function AiStatusBanner({ machineId }) {
  const [aiData, setAiData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    const fetchAiData = async () => {
      try {
        const token = sessionStorage.getItem('token') || localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.get(`/machines/${machineId}/latest-ai`, {
          headers,
          params: { _ts: Date.now() }
        });
        setAiData(res.data);
        setFetchError(false);
      } catch (err) {
        setFetchError(true);
        console.error('AI data fetch error for machine', machineId, err);
      } finally {
        setLoading(false);
      }
    };

    fetchAiData();

    const intervalId = setInterval(fetchAiData, 15000);
    const onFocus = () => fetchAiData();
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
    };
  }, [machineId]);

  const hasData = aiData && (aiData.anomaly?.timestamp || aiData.fault?.timestamp || aiData.rul?.timestamp);
  const mode = loading ? 'loading' : fetchError ? 'error' : hasData ? 'live' : 'idle';

  const safeAiData = aiData || {};
  const anomalyData = safeAiData.anomaly;
  const faultData = safeAiData.fault;
  const rulData = safeAiData.rul;

  const timestamps = [anomalyData?.timestamp, faultData?.timestamp, rulData?.timestamp].filter(Boolean);
  const latestDate = timestamps.length > 0
    ? timestamps.reduce((latest, current) => {
        if (!latest) return current;
        const latestTime = parseTimestamp(latest).getTime();
        const currentTime = parseTimestamp(current).getTime();
        if (Number.isNaN(currentTime)) return latest;
        if (Number.isNaN(latestTime)) return current;
        return currentTime > latestTime ? current : latest;
      }, null)
    : null;

  const ANOMALY_THRESHOLD = 0.75;
  const anomalyScore = Number(anomalyData?.value);
  const hasAnomalyScore = Number.isFinite(anomalyScore);
  const anomalyLabel = (anomalyData?.label || '').toLowerCase();
  const labelSignalsAnomaly =
    anomalyLabel.includes('anomaly') ||
    anomalyLabel.includes('anom') ||
    anomalyLabel.includes('fault') ||
    anomalyLabel.includes('porucha');
  const labelSignalsHealthy =
    anomalyLabel.includes('healthy') ||
    anomalyLabel.includes('zdrav') ||
    anomalyLabel.includes('normal') ||
    anomalyLabel.includes('none');

  const isAnomalyDetected = hasAnomalyScore
    ? anomalyScore > ANOMALY_THRESHOLD
    : (labelSignalsAnomaly && !labelSignalsHealthy);
  const isFaultClassified = faultData?.label && !faultData.label.toLowerCase().includes('zdrav');
  const isError = mode === 'live' && (isAnomalyDetected || isFaultClassified);

  let bannerClass = 'ai-banner';
  if (mode === 'live') {
    bannerClass += isError ? ' ai-banner--error' : ' ai-banner--ok';
  } else if (mode === 'loading') {
    bannerClass += ' ai-banner--loading';
  } else {
    bannerClass += ' ai-banner--empty';
    if (mode === 'idle') bannerClass += ' ai-banner--idle';
    if (mode === 'error') bannerClass += ' ai-banner--error-soft';
  }

  const statusText = mode === 'live' && latestDate ? formatDate(latestDate) : '';

  const fallbackMetricLabel =
    mode === 'loading'
      ? 'Pending'
      : mode === 'error'
      ? 'Unavailable'
      : mode === 'idle'
      ? 'Waiting data'
      : 'Not run';

  const anomalyText =
    mode === 'live' && anomalyData?.timestamp
      ? (isAnomalyDetected ? 'Detected' : 'None')
      : fallbackMetricLabel;

  const anomalyConfidence =
    mode === 'live' && anomalyData?.timestamp
      ? `(${anomalyData.value?.toFixed(2)})`
      : null;

  const faultText =
    mode === 'live' && faultData?.timestamp
      ? faultData.label
      : fallbackMetricLabel;

  const faultConfidence =
    mode === 'live' && faultData?.timestamp
      ? `(${(faultData.confidence * 100).toFixed(0)}%)`
      : null;

  const rulText =
    mode === 'live' && rulData?.timestamp
      ? `${rulData.value} days`
      : fallbackMetricLabel;

  return (
    <div className={bannerClass} role="status" aria-live="polite">
      <div className="ai-banner-header">
        <div className="ai-banner-header-left">
          <AiIcon />
          <span className="ai-banner-title">AI Diagnostics</span>
        </div>
        <span className="ai-banner-timestamp">{statusText}</span>
      </div>

      <div className="ai-banner-metrics">
        <div className="ai-metric">
          <span className="ai-metric-label">Anomaly</span>
          <span className={`ai-metric-value ${mode === 'live' && anomalyData?.timestamp ? (isAnomalyDetected ? 'ai-metric-value--bad' : 'ai-metric-value--good') : 'ai-metric-value--pending'}`}>
            {anomalyText}
            {anomalyConfidence && <span className="ai-metric-confidence">{anomalyConfidence}</span>}
          </span>
        </div>

        <div className="ai-metric">
          <span className="ai-metric-label">Fault class</span>
          <span className={`ai-metric-value ${mode === 'live' && faultData?.timestamp ? (isFaultClassified ? 'ai-metric-value--bad' : 'ai-metric-value--good') : 'ai-metric-value--pending'}`}>
            {faultText}
            {faultConfidence && <span className="ai-metric-confidence">{faultConfidence}</span>}
          </span>
        </div>

        <div className="ai-metric">
          <span className="ai-metric-label">RUL estimate</span>
          <span className={`ai-metric-value ${mode === 'live' && rulData?.timestamp ? 'ai-metric-value--rul' : 'ai-metric-value--pending'}`}>{rulText}</span>
        </div>
      </div>
    </div>
  );
}

export default AiStatusBanner;