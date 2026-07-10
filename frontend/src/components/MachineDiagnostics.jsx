import { useState } from 'react';
import axios from 'axios';

function MachineDiagnostics({ machineId, onDiagnosisComplete }) {
  // --- 0. STAV: RUČNÍ SBĚR + AUTO AI ---
  const [collectLoading, setCollectLoading] = useState(false);
  const [collectResult, setCollectResult] = useState(null);

  // --- 1. STAV: DETEKCE ANOMÁLIÍ (AE_ANOWGAN) ---
  const [anomalyLoading, setAnomalyLoading] = useState(false);
  const [anomalyResult, setAnomalyResult] = useState(null);

  // --- 2. STAV: KLASIFIKACE PORUCH (1D_CNNwWGN) ---
  const [classLoading, setClassLoading] = useState(false);
  const [classResult, setClassResult] = useState(null);

  // --- 3. STAV: PREDIKCE RUL (Bi-LSTM) ---
  const [rulLoading, setRulLoading] = useState(false);
  const [rulResult, setRulResult] = useState(null);

  // Získání tokenu (podle toho, jak ho máš v aplikaci uložený)
  const getAuthHeader = () => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // --- FUNKCE PRO SPUŠTĚNÍ JEDNOTLIVÝCH MODELŮ ---

  const runManualCollectAndAi = async () => {
    setCollectLoading(true);
    setCollectResult(null);
    try {
      const res = await axios.post(
        `/machines/${machineId}/collect-now?run_ai=true`,
        {},
        { headers: getAuthHeader() }
      );
      setCollectResult(res.data);
      if (onDiagnosisComplete) onDiagnosisComplete();
    } catch (error) {
      alert('Manual collection failed: ' + (error.response?.data?.detail || error.message));
    } finally {
      setCollectLoading(false);
    }
  };

  const runAnomalyDetection = async () => {
    setAnomalyLoading(true);
    setAnomalyResult(null);
    try {
      const res = await axios.post(
        `/machines/${machineId}/analyze-anomaly`,
        {}, 
        { headers: getAuthHeader() }
      );
      setAnomalyResult(res.data);
      if (onDiagnosisComplete) onDiagnosisComplete();
    } catch (error) {
      alert('Anomaly detection failed: ' + (error.response?.data?.detail || error.message));
    } finally {
      setAnomalyLoading(false);
    }
  };

  const runClassification = async () => {
    setClassLoading(true);
    setClassResult(null);
    try {
      const res = await axios.post(
        `/machines/${machineId}/classify-fault`,
        {}, 
        { headers: getAuthHeader() }
      );
      setClassResult(res.data);
      if (onDiagnosisComplete) onDiagnosisComplete();
    } catch (error) {
      alert('Fault classification failed: ' + (error.response?.data?.detail || error.message));
    } finally {
      setClassLoading(false);
    }
  };

  const runRULAnalysis = async () => {
    setRulLoading(true);
    setRulResult(null);
    try {
      const res = await axios.post(
        `/machines/${machineId}/predict-rul`,
        {},
        { headers: getAuthHeader() }
      );
      setRulResult(res.data);
      if (onDiagnosisComplete) onDiagnosisComplete();
    } catch (error) {
      alert('RUL prediction failed: ' + (error.response?.data?.detail || error.message));
    } finally {
      setRulLoading(false);
    }
  };

  return (
    <div className="diag-grid">

      {/* =====================================================================
         0. MANUAL COLLECTION + AUTOMATIC AI CHAIN
         ===================================================================== */}
      <div className="detail-card diag-card">
        <div className="diag-card-header">
          <div>
            <h2 className="diag-card-title">Manual Collection + AI</h2>
            <p className="diag-card-desc">
              Downloads fresh raw files from PLC via FTP and starts anomaly, fault classification and RUL analysis.
            </p>
          </div>
          <span className="role-badge user diag-model-badge">PLC FTP + AI Chain</span>
        </div>

        {collectResult ? (
          <div className="diag-result diag-result--info">
            <div className="diag-result-row">
              <span className="diag-result-label">New measurements</span>
              <span className="diag-result-value">{collectResult.collection?.created_count ?? 0}</span>
            </div>
            <div className="diag-result-row">
              <span className="diag-result-label">Collection errors</span>
              <span className="diag-result-value">{collectResult.collection?.errors?.length ?? 0}</span>
            </div>
            {!!collectResult.collection?.errors?.length && (
              <div style={{ marginTop: '0.6rem', textAlign: 'left' }}>
                {collectResult.collection.errors.map((err, idx) => (
                  <div key={`${idx}-${err}`} style={{ fontSize: '0.82rem', opacity: 0.9, marginBottom: '0.24rem' }}>
                    • {err}
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setCollectResult(null)} className="btn-cancel diag-reset-btn">
              Clear result
            </button>
          </div>
        ) : (
          <button className="btn-diagnose diag-run-btn diag-run-btn--info" onClick={runManualCollectAndAi} disabled={collectLoading}>
            {collectLoading
              ? <><span className="loading-spinner" aria-hidden="true"></span>Collecting + analysing…</>
              : 'Collect from PLC and run AI'}
          </button>
        )}
      </div>
      
      {/* =====================================================================
         1. ANOMALY DETECTION (AE_ANOWGAN)
         ===================================================================== */}
      <div className="detail-card diag-card">
        <div className="diag-card-header">
          <div>
            <h2 className="diag-card-title">Anomaly Detection</h2>
            <p className="diag-card-desc">
              Auto-Encoder GAN converts the signal to a time–frequency representation and computes an Anomaly Score from the reconstruction error.
            </p>
          </div>
          <span className="role-badge active diag-model-badge">AE_ANOWGAN · CWT</span>
        </div>

        {anomalyResult ? (
          <div className={`diag-result diag-result--${anomalyResult.is_anomaly ? 'fault' : 'ok'}`}>
            <div className="diag-result-row">
              <span className="diag-result-label">Anomaly score</span>
              <span className="diag-result-value">{anomalyResult.anomaly_score?.toFixed(4)}</span>
            </div>
            <div className="diag-result-row">
              <span className="diag-result-label">Status</span>
              <span className={`role-badge ${anomalyResult.is_anomaly ? 'FAULT' : 'OK'}`}>
                {anomalyResult.is_anomaly ? 'Anomaly detected' : 'Healthy'}
              </span>
            </div>
            <button onClick={() => setAnomalyResult(null)} className="btn-cancel diag-reset-btn">
              Clear result
            </button>
          </div>
        ) : (
          <button className="btn-diagnose diag-run-btn" onClick={runAnomalyDetection} disabled={anomalyLoading}>
            {anomalyLoading
              ? <><span className="loading-spinner" aria-hidden="true"></span>Computing…</>
              : 'Run anomaly detection'}
          </button>
        )}
      </div>

      {/* =====================================================================
         2. FAULT CLASSIFICATION (1D_CNNwWGN)
         ===================================================================== */}
      <div className="detail-card diag-card">
        <div className="diag-card-header">
          <div>
            <h2 className="diag-card-title">Fault Classification</h2>
            <p className="diag-card-desc">
              1D-CNN trained with WGAN identifies the exact bearing fault type from the FFT frequency spectrum.
            </p>
          </div>
          <span className="role-badge FAULT diag-model-badge">1D_CNN · FFT</span>
        </div>

        {classResult ? (
          <div className="diag-result diag-result--fault">
            <div className="diag-result-row">
              <span className="diag-result-label">Fault type</span>
              <span className="diag-result-value diag-result-value--large">{classResult.fault_type}</span>
            </div>
            <div className="diag-result-row">
              <span className="diag-result-label">Confidence</span>
              <span className="diag-result-value">{(classResult.confidence * 100).toFixed(1)} %</span>
            </div>
            <button onClick={() => setClassResult(null)} className="btn-cancel diag-reset-btn">
              Clear result
            </button>
          </div>
        ) : (
          <button className="btn-diagnose diag-run-btn diag-run-btn--fault" onClick={runClassification} disabled={classLoading}>
            {classLoading
              ? <><span className="loading-spinner" aria-hidden="true"></span>Classifying…</>
              : 'Run fault classification'}
          </button>
        )}
      </div>

      {/* =====================================================================
         3. RUL PREDICTION (Bi-LSTM)
         ===================================================================== */}
      <div className="detail-card diag-card">
        <div className="diag-card-header">
          <div>
            <h2 className="diag-card-title">RUL Prediction</h2>
            <p className="diag-card-desc">
              Bi-LSTM ensemble evaluates time-series trends. The model variant (inner / outer ring) is selected automatically from the classification result.
            </p>
          </div>
          <span className="role-badge user diag-model-badge">Bi-LSTM · Ensemble</span>
        </div>

        {rulResult ? (
          <div className="diag-result diag-result--info">
            <div className="diag-rul-display">
              <span className="diag-rul-label">Remaining Useful Life</span>
              <span className="diag-rul-value">{rulResult.rul_value} <span className="diag-rul-unit">{rulResult.unit}</span></span>
              <span className="diag-rul-model">Model: {rulResult.used_model}</span>
            </div>
            <button onClick={() => setRulResult(null)} className="btn-cancel diag-reset-btn">
              Clear result
            </button>
          </div>
        ) : (
          <button className="btn-diagnose diag-run-btn diag-run-btn--info" onClick={runRULAnalysis} disabled={rulLoading}>
            {rulLoading
              ? <><span className="loading-spinner" aria-hidden="true"></span>Analysing…</>
              : 'Estimate remaining life'}
          </button>
        )}
      </div>

    </div>
  );
}

export default MachineDiagnostics;