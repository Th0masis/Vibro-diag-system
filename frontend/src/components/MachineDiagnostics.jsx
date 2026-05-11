import { useState } from 'react';
import axios from 'axios';

function MachineDiagnostics({ machineId, onDiagnosisComplete }) {
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
      alert("Chyba při spouštění detekce anomálií: " + (error.response?.data?.detail || error.message));
    } finally {
      setAnomalyLoading(false);
    }
  };

  const runClassification = async () => {
    setClassLoading(true);
    setClassResult(null);
    try {
      const res = await axios.post(
        `http://127.0.0.1:8000/machines/${machineId}/classify-fault`,
        {}, 
        { headers: getAuthHeader() }
      );
      setClassResult(res.data);
      if (onDiagnosisComplete) onDiagnosisComplete();
    } catch (error) {
      alert("Chyba při klasifikaci poruchy: " + (error.response?.data?.detail || error.message));
    } finally {
      setClassLoading(false);
    }
  };

  const runRULAnalysis = async () => {
    setRulLoading(true);
    setRulResult(null);
    try {
      const res = await axios.post(
        `http://127.0.0.1:8000/machines/${machineId}/predict-rul`,
        {},
        { headers: getAuthHeader() }
      );
      setRulResult(res.data);
      if (onDiagnosisComplete) onDiagnosisComplete();
    } catch (error) {
      alert("Chyba při predikci životnosti: " + (error.response?.data?.detail || error.message));
    } finally {
      setRulLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '25px' }}>
      
      {/* =====================================================================
          SEKCE 1: DETEKCE ANOMÁLIÍ (AE_ANOWGAN)
         ===================================================================== */}
      <div className="detail-card card-sensors" style={{ borderTop: '4px solid var(--br-orange)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h2 className="card-title" style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.4rem' }}>
              1. Detekce Anomálií
            </h2>
            <span className="role-badge active">AE_ANOWGAN (CWT)</span>
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '20px' }}>
          Unsupervised Auto-Encoder GAN model. Převádí signál na časově-frekvenční reprezentaci (TFR) a počítá Anomaly Score na základě chyby rekonstrukce.
        </p>

        {anomalyResult ? (
          <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Anomaly Score:</span>
              <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: anomalyResult.is_anomaly ? 'var(--vut-red)' : '#16a34a' }}>
                {anomalyResult.anomaly_score?.toFixed(4)}
              </span>
            </div>
            <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>Status:</span>
              <span className={`role-badge ${anomalyResult.is_anomaly ? 'FAULT' : 'OK'}`}>
                {anomalyResult.is_anomaly ? 'ZJIŠTĚNA ANOMÁLIE' : 'ZDRÁVÝ CHOD'}
              </span>
            </div>
            <button onClick={() => setAnomalyResult(null)} className="btn-cancel" style={{ marginTop: '15px', width: '100%', padding: '8px' }}>
              Resetovat výsledek
            </button>
          </div>
        ) : (
          <button 
            className="btn-diagnose" 
            onClick={runAnomalyDetection} 
            disabled={anomalyLoading}
            style={{ width: '100%' }}
          >
            {anomalyLoading ? '⏳ Generuji CWT a počítám skóre...' : '🔍 Spustit detekci anomálií'}
          </button>
        )}
      </div>

      {/* =====================================================================
          SEKCE 2: KLASIFIKACE PORUCH (1D_CNNwWGN)
         ===================================================================== */}
      <div className="detail-card card-tech" style={{ borderTop: '4px solid var(--vut-red)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h2 className="card-title" style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.4rem' }}>
              2. Klasifikace Poruchy
            </h2>
            <span className="role-badge active">1D_CNNwWGN (FFT)</span>
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '20px' }}>
          Konvoluční neuronová síť 1D trénovaná pomocí WGAN. Určuje přesný typ mechanické závady ložiska z frekvenčního spektra (FFT).
        </p>

        {classResult ? (
          <div style={{ background: '#fff5f5', padding: '15px', borderRadius: '8px', border: '1px solid #fecaca', marginBottom: '15px' }}>
            <div style={{ textAlign: 'center', marginBottom: '15px' }}>
              <span style={{ color: 'var(--vut-red)', fontWeight: 600, display: 'block', marginBottom: '5px' }}>Detekovaný typ poruchy:</span>
              <span style={{ fontSize: '1.6rem', fontWeight: 'bold', color: 'var(--vut-red-dark)' }}>
                {classResult.fault_type}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '10px', borderRadius: '6px' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Jistota modelu (Confidence):</span>
              <strong style={{ color: 'var(--text-main)' }}>{(classResult.confidence * 100).toFixed(1)} %</strong>
            </div>
            <button onClick={() => setClassResult(null)} className="btn-cancel" style={{ marginTop: '15px', width: '100%', padding: '8px' }}>
              Resetovat výsledek
            </button>
          </div>
        ) : (
          <button 
            className="btn-diagnose" 
            onClick={runClassification} 
            disabled={classLoading}
            style={{ width: '100%', background: 'var(--vut-red)' }}
          >
            {classLoading ? '⏳ Klasifikuji poruchu...' : '🏷️ Spustit klasifikaci poruchy'}
          </button>
        )}
      </div>

      {/* =====================================================================
          SEKCE 3: PREDIKCE RUL (Bi-LSTM)
         ===================================================================== */}
      <div className="detail-card card-note" style={{ borderTop: '4px solid var(--blue-primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h2 className="card-title" style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.4rem' }}>
              3. Predikce Životnosti (RUL)
            </h2>
            <span className="role-badge user">Bi-LSTM Ensemble</span>
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '20px' }}>
          Rekurentní neuronové sítě vyhodnocující časové řady. Automaticky se zvolí specifický model (Vnitřní/Vnější kroužek) dle výsledku klasifikace.
        </p>

        {rulResult ? (
          <div style={{ background: '#e0f2fe', padding: '20px', borderRadius: '8px', border: '1px solid #bae6fd', marginBottom: '15px' }}>
             <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '0.95rem', color: 'var(--blue-dark)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>
                  Zbývající užitečná životnost (RUL)
                </span>
                <div style={{ fontSize: '3.5rem', fontWeight: 'bold', color: 'var(--blue-primary)', margin: '10px 0' }}>
                    {rulResult.rul_value} {rulResult.unit}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--blue-dark)', opacity: 0.8 }}>
                    Použitý model: <strong>{rulResult.used_model}</strong>
                </div>
            </div>
            <button onClick={() => setRulResult(null)} className="btn-cancel" style={{ marginTop: '20px', width: '100%', padding: '8px', background: 'white', color: 'var(--blue-dark)' }}>
              Resetovat výsledek
            </button>
          </div>
        ) : (
          <button 
            className="btn-diagnose" 
            onClick={runRULAnalysis} 
            disabled={rulLoading}
            style={{ width: '100%', background: 'var(--blue-primary)' }}
          >
            {rulLoading ? '⏳ Analyzuji časové řady...' : '⏱️ Odhadnout zbývající životnost'}
          </button>
        )}
      </div>

    </div>
  );
}

export default MachineDiagnostics;