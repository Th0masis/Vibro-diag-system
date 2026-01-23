import { useState } from 'react';
import axios from 'axios';

function MachineDiagnostics({ machineId, onDiagnosisComplete }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // Zde se uloží výsledek JSON z backendu

  const runAnalysis = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await axios.post(`http://127.0.0.1:8000/machines/${machineId}/diagnose`);
      setResult(res.data);
      // Zavoláme refresh rodiče, aby se změnil status v hlavičce stroje
      if (onDiagnosisComplete) onDiagnosisComplete();
    } catch (error) {
      alert("Chyba při spouštění diagnostiky.");
    } finally {
      setLoading(false);
    }
  };

  // Pomocná barva pro výsledek
  const getResultColor = (status) => {
    if (status === 'OK') return '#166534'; // Zelená
    if (status === 'WARNING') return '#ca8a04'; // Oranžová
    return '#dc2626'; // Červená
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      
      {/* 1. KARTA MODELU */}
      <div className="detail-card" style={{ borderTop: '4px solid #8b5cf6' }}> {/* Fialová pro AI */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, color: '#5b21b6' }}>✨ AI Diagnostika</h2>
            <span style={{ background: '#f3e8ff', color: '#6b21a8', padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                Model Ready
            </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
            <div className="detail-item">
                <label>Nasazený model</label>
                <p style={{ fontWeight: 'bold' }}>VibroGuard Random Forest v2.4</p>
            </div>
            <div className="detail-item">
                <label>Trénovací data</label>
                <p>15,400 vzorků (Ložiska & Motory)</p>
            </div>
            <div className="detail-item">
                <label>Přesnost modelu (Validace)</label>
                <p>96.4%</p>
            </div>
            <div className="detail-item">
                <label>Poslední trénink</label>
                <p>12.01.2025</p>
            </div>
        </div>

        <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px dashed #cbd5e1', marginBottom: '25px' }}>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem', fontStyle: 'italic' }}>
                Diagnostika analyzuje posledních 50 měření a hledá vzorce odpovídající známým poruchám (nevyváženost, uvolnění, vady ložisek).
            </p>
        </div>

        <button 
            className="btn-diagnose" 
            onClick={runAnalysis} 
            disabled={loading}
            style={{ width: '100%', padding: '15px', fontSize: '1.1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}
        >
            {loading ? (
                <>⚙️ Probíhá analýza neuronové sítě...</>
            ) : (
                <>🚀 Spustit kompletní diagnostiku</>
            )}
        </button>
      </div>

      {/* 2. MODÁL S VÝSLEDKEM (VYSKOČÍ PO DOKONČENÍ) */}
      {result && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px', textAlign: 'center', borderTop: `6px solid ${getResultColor(result.status)}` }}>
            
            <h2 style={{ color: getResultColor(result.status), fontSize: '2rem', margin: '10px 0' }}>
                {result.status}
            </h2>
            
            <p style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#334155' }}>
                {result.prediction}
            </p>

            <div style={{ margin: '20px 0', padding: '15px', background: '#f8fafc', borderRadius: '8px', textAlign: 'left' }}>
                <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Jistota modelu:</span>
                    <strong style={{ color: '#334155' }}>{(result.confidence * 100).toFixed(1)} %</strong>
                </div>
                {/* Progress bar pro jistotu */}
                <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ 
                        width: `${result.confidence * 100}%`, 
                        height: '100%', 
                        background: getResultColor(result.status) 
                    }}></div>
                </div>
            </div>

            <div style={{ textAlign: 'left', marginBottom: '20px' }}>
                <h4 style={{ margin: '0 0 5px 0', color: '#475569' }}>Detaily analýzy:</h4>
                <p style={{ margin: 0, color: '#64748b', lineHeight: '1.4' }}>{result.description}</p>
            </div>

            <div style={{ textAlign: 'left', padding: '15px', background: result.status === 'OK' ? '#dcfce7' : '#fee2e2', borderRadius: '8px', border: `1px solid ${result.status === 'OK' ? '#bbf7d0' : '#fecaca'}` }}>
                <h4 style={{ margin: '0 0 5px 0', color: result.status === 'OK' ? '#166534' : '#991b1b' }}>Doporučení:</h4>
                <p style={{ margin: 0, color: result.status === 'OK' ? '#14532d' : '#7f1d1d', fontWeight: '500' }}>
                    {result.recommendation}
                </p>
            </div>

            <button 
                className="btn-add-confirm" 
                onClick={() => setResult(null)} 
                style={{ marginTop: '25px', width: '100%', padding: '12px' }}
            >
                Zavřít a potvrdit
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

export default MachineDiagnostics;