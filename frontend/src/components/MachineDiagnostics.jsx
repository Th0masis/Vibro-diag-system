import { useState } from 'react';
import axios from 'axios';

function MachineDiagnostics({ machineId, onDiagnosisComplete }) {
  // --- STAV PRO KLASICKOU DIAGNOSTIKU (CO SE DĚJE) ---
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagResult, setDiagResult] = useState(null);

  // --- STAV PRO RUL PREDIKCI (KDY SE TO POKAZÍ) ---
  const [rulLoading, setRulLoading] = useState(false);
  const [rulResult, setRulResult] = useState(null);

  // 1. Funkce pro spuštění diagnostiky poruch (Původní)
  const runAnalysis = async () => {
    setDiagLoading(true);
    setDiagResult(null);
    try {
      // Předpokládáme auth token v localStorage
      const token = localStorage.getItem('token');
      const res = await axios.post(
        `http://127.0.0.1:8000/machines/${machineId}/diagnose`,
        {}, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setDiagResult(res.data);
      if (onDiagnosisComplete) onDiagnosisComplete();
    } catch (error) {
      alert("Chyba při spouštění diagnostiky.");
    } finally {
      setDiagLoading(false);
    }
  };

  // 2. Funkce pro spuštění RUL predikce (Nová)
  const runRULAnalysis = async () => {
    setRulLoading(true);
    setRulResult(null);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(
        `http://127.0.0.1:8000/machines/${machineId}/rul`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRulResult(res.data);
    } catch (error) {
      console.error(error);
      alert("Chyba při načítání RUL predikce.");
    } finally {
      setRulLoading(false);
    }
  };

  // Pomocná barva pro výsledek diagnostiky
  const getResultColor = (status) => {
    if (status === 'OK') return '#166534';
    if (status === 'WARNING') return '#ca8a04';
    return '#dc2626';
  };

  // Pomocná barva pro RUL (podle počtu dní)
  const getRulColor = (days) => {
    if (days === null) return '#94a3b8'; // Šedá (neznámo)
    if (days > 14) return '#166534';     // Zelená
    if (days > 7) return '#ca8a04';      // Oranžová
    return '#dc2626';                    // Červená
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* ==========================================================================================
          SEKCE 1: AI DIAGNOSTIKA (CO SE DĚJE?) - FIALOVÁ
         ========================================================================================== */}
      <div className="detail-card" style={{ borderTop: '4px solid #8b5cf6', background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, color: '#5b21b6' }}>✨ AI Diagnostika Poruch</h2>
            <span style={{ background: '#f3e8ff', color: '#6b21a8', padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                Classification Ready
            </span>
        </div>

        {/* Info o modelu */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            <div className="detail-item">
                <label style={{display:'block', fontSize:'0.85rem', color:'#64748b'}}>Nasazený model</label>
                <strong style={{color:'#1e293b'}}>VibroGuard Random Forest v2.4</strong>
            </div>
            <div className="detail-item">
                <label style={{display:'block', fontSize:'0.85rem', color:'#64748b'}}>Přesnost</label>
                <strong style={{color:'#1e293b'}}>96.4% (Validace)</strong>
            </div>
        </div>

        <button 
            className="btn-diagnose" 
            onClick={runAnalysis} 
            disabled={diagLoading}
            style={{ 
                width: '100%', padding: '12px', fontSize: '1rem', 
                background: diagLoading ? '#e2e8f0' : '#7c3aed', 
                color: diagLoading ? '#94a3b8' : 'white',
                border: 'none', borderRadius: '6px', cursor: diagLoading ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s'
            }}
        >
            {diagLoading ? '⚙️ Analyzuji signál...' : '🚀 Spustit diagnostiku poruch'}
        </button>
      </div>

      {/* ==========================================================================================
          SEKCE 2: RUL PREDIKCE (KDY SE TO POKAZÍ?) - MODRÁ
         ========================================================================================== */}
      <div className="detail-card" style={{ borderTop: '4px solid #3b82f6', background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, color: '#1e40af' }}>⏳ Predikce Životnosti (RUL)</h2>
            <span style={{ background: '#dbeafe', color: '#1e40af', padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                LSTM / Regression
            </span>
        </div>

        <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px dashed #cbd5e1', marginBottom: '20px' }}>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
                Tento modul využívá <strong>LSTM neuronovou síť</strong> (trénovanou na NASA IMS datech) a matematickou regresi k odhadu zbývajícího času do kritického selhání.
            </p>
        </div>

        {/* Pokud máme výsledek, zobrazíme ho, jinak tlačítko */}
        {rulResult ? (
            <div style={{ animation: 'fadeIn 0.5s' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#eff6ff', padding: '20px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                    
                    {/* Hlavní číslo */}
                    <div>
                        <span style={{ fontSize: '0.9rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Zbývá přibližně</span>
                        <div style={{ fontSize: '3rem', fontWeight: 'bold', color: getRulColor(rulResult.final_prediction_days), lineHeight: '1' }}>
                            {rulResult.final_prediction_days !== null ? `${rulResult.final_prediction_days} dní` : 'N/A'}
                        </div>
                        <div style={{ marginTop: '5px', fontSize: '0.85rem', color: '#1e3a8a' }}>
                            Doporučený model: <strong>{rulResult.recommended_model === 'lstm_ai' ? 'Deep Learning LSTM' : rulResult.recommended_model}</strong>
                        </div>
                    </div>

                    {/* Detaily modelů */}
                    <div style={{ textAlign: 'right', borderLeft: '1px solid #dbeafe', paddingLeft: '20px' }}>
                        <div style={{marginBottom: '5px', fontSize: '0.9rem', color: '#475569'}}>
                            Linear: <strong>{rulResult.models.linear_rul_days ?? '-'}</strong> dní
                        </div>
                        <div style={{marginBottom: '5px', fontSize: '0.9rem', color: '#475569'}}>
                            Exponenciální: <strong>{rulResult.models.exponential_rul_days ?? '-'}</strong> dní
                        </div>
                        <div style={{fontSize: '0.9rem', color: '#2563eb', fontWeight: 'bold'}}>
                            LSTM (AI): {rulResult.models.lstm_ai_rul_days ?? '-'} dní
                        </div>
                    </div>
                </div>
                
                <button 
                    onClick={() => setRulResult(null)}
                    style={{ marginTop: '15px', background: 'transparent', border: '1px solid #94a3b8', color: '#64748b', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                    🔄 Resetovat analýzu
                </button>
            </div>
        ) : (
            <button 
                className="btn-rul" 
                onClick={runRULAnalysis} 
                disabled={rulLoading}
                style={{ 
                    width: '100%', padding: '12px', fontSize: '1rem', 
                    background: rulLoading ? '#e2e8f0' : '#2563eb', 
                    color: rulLoading ? '#94a3b8' : 'white',
                    border: 'none', borderRadius: '6px', cursor: rulLoading ? 'not-allowed' : 'pointer',
                    transition: 'background 0.2s'
                }}
            >
                {rulLoading ? '⏳ Počítám regresi a LSTM...' : '📊 Spustit predikci životnosti'}
            </button>
        )}
      </div>


      {/* ==========================================================================================
          MODÁL PRO DIAGNOSTIKU (PŮVODNÍ)
         ========================================================================================== */}
      {diagResult && (
        <div className="modal-overlay" style={{
            position:'fixed', top:0, left:0, width:'100%', height:'100%', 
            background:'rgba(0,0,0,0.5)', display:'flex', justifyContent:'center', alignItems:'center', zIndex: 1000
        }}>
          <div className="modal-content" style={{ 
              background:'white', padding:'30px', borderRadius:'12px', width:'90%', maxWidth:'500px', 
              textAlign: 'center', borderTop: `6px solid ${getResultColor(diagResult.status)}` 
          }}>
            
            <h2 style={{ color: getResultColor(diagResult.status), fontSize: '2rem', margin: '10px 0' }}>
                {diagResult.status}
            </h2>
            
            <p style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#334155' }}>
                {diagResult.prediction}
            </p>

            <div style={{ margin: '20px 0', padding: '15px', background: '#f8fafc', borderRadius: '8px', textAlign: 'left' }}>
                <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Jistota modelu:</span>
                    <strong style={{ color: '#334155' }}>{(diagResult.confidence * 100).toFixed(1)} %</strong>
                </div>
                <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${diagResult.confidence * 100}%`, height: '100%', background: getResultColor(diagResult.status) }}></div>
                </div>
            </div>

            <div style={{ textAlign: 'left', marginBottom: '20px' }}>
                <h4 style={{ margin: '0 0 5px 0', color: '#475569' }}>Detaily analýzy:</h4>
                <p style={{ margin: 0, color: '#64748b', lineHeight: '1.4' }}>{diagResult.description}</p>
            </div>

            <button 
                onClick={() => setDiagResult(null)} 
                style={{ 
                    marginTop: '15px', width: '100%', padding: '12px', 
                    background: '#e2e8f0', border:'none', borderRadius:'6px', cursor:'pointer', fontWeight:'bold', color:'#475569'
                }}
            >
                Zavřít
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

export default MachineDiagnostics;