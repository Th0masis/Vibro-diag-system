import { useState, useEffect } from 'react';
import axios from 'axios';
import ModelTrainingModal from '../components/ModelTrainingModal';

function MlSector() {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  
  // Stav pro otevírání nového tréninkového wizardu
  const [isTrainingModalOpen, setIsTrainingModalOpen] = useState(false);

 useEffect(() => {
    const fetchModels = async () => {
      try {
        setLoading(true);
        // Získáme token
        const token = sessionStorage.getItem('token') || localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        // Přidáme token do požadavku
        const res = await axios.get('http://127.0.0.1:8000/ml-models', { headers });
        
        setModels(res.data);
        if (res.data.length > 0) {
          setSelectedModel(res.data[0]);
        }
      } catch (err) {
        console.error("Chyba při načítání ML modelů", err);
        setError("Nepodařilo se načíst modely ze serveru. Zkontrolujte přihlášení.");
      } finally {
        setLoading(false);
      }
    };

    fetchModels();
  }, []);
  
  if (loading) return <div className="main-content">Načítám Machine Learning sektor...</div>;
  if (error) return <div className="main-content" style={{ color: 'var(--vut-red)' }}>{error}</div>;

  return (
    <div className="main-content" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      
      {/* HLAVIČKA STRÁNKY */}
      <div className="machine-header-container" style={{ marginBottom: '20px' }}>
        <div className="machine-title-section">
          <h1>
            <span style={{ color: 'var(--text-main)' }}>AI & ML Sektor</span>
          </h1>
          <div className="machine-meta">
            Správa prediktivních modelů | Aktivních: {models.filter(m => m.is_active).length}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '25px', flex: 1, alignItems: 'flex-start' }}>
        
        {/* LEVÝ PANEL: SEZNAM MODELŮ */}
        <div className="detail-card card-tech" style={{ width: '320px', padding: 0, overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ background: '#f8fafc', padding: '15px 20px', borderBottom: '1px solid #e2e8f0' }}>
            <h3 className="card-title" style={{ margin: 0, fontSize: '1.1rem' }}>Katalog modelů</h3>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {models.map(model => {
              const isSelected = selectedModel?.id_model === model.id_model;
              
              return (
                <button 
                  key={model.id_model}
                  onClick={() => setSelectedModel(model)}
                  style={{
                    padding: '15px 20px',
                    background: isSelected ? 'rgba(249, 146, 68, 0.08)' : 'white',
                    border: 'none',
                    borderLeft: `4px solid ${isSelected ? 'var(--br-orange)' : 'transparent'}`,
                    borderBottom: '1px solid #f1f5f9',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    transition: 'all 0.2s',
                    width: '100%'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <span style={{ fontWeight: 'bold', color: isSelected ? 'var(--br-orange)' : 'var(--text-main)', fontSize: '1rem' }}>
                      {model.name} 
                      <span style={{ marginLeft: '8px', fontSize: '0.75rem', fontWeight: 'normal', opacity: 0.6, color: 'var(--text-muted)' }}>
                        v{model.version}
                      </span>
                    </span>
                    <span className={`role-badge ${model.is_active ? 'available' : 'STOPPED'}`} style={{ padding: '2px 8px', fontSize: '0.6rem' }}>
                      {model.is_active ? 'AKTIVNÍ' : 'OFF'}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{model.type}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* PRAVÝ PANEL: DETAIL VYBRANÉHO MODELU */}
        {selectedModel ? (
          <div className="detail-card card-sensors" style={{ flex: 1, padding: 0, overflow: 'hidden' }}>
            
            {/* Barevná hlavička detailu */}
            <div style={{ 
              background: 'linear-gradient(90deg, var(--vut-red) 0%, var(--br-orange) 100%)', 
              padding: '25px 30px', 
              color: 'white',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '5px' }}>
                  <h2 style={{ margin: 0, fontSize: '2.2rem', fontWeight: 800 }}>{selectedModel.name}</h2>
                  <span className="role-badge" style={{ background: 'rgba(255,255,255,0.25)', color: 'white', border: '1px solid rgba(255,255,255,0.4)' }}>
                    v{selectedModel.version}
                  </span>
                </div>
                <p style={{ margin: 0, opacity: 0.9, fontSize: '1.1rem', fontWeight: 500 }}>{selectedModel.type}</p>
              </div>
              <div>
                <span className={`role-badge ${selectedModel.is_active ? 'OK' : 'STOPPED'}`} style={{ fontSize: '0.85rem', padding: '6px 12px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                  {selectedModel.is_active ? 'PRODUKČNÍ NASAZENÍ' : 'ODSTAVENO'}
                </span>
              </div>
            </div>

            {/* Tělo detailu */}
            <div style={{ padding: '30px' }}>
              
              <div className="detail-grid" style={{ marginBottom: '30px' }}>
                <div className="detail-card" style={{ alignItems: 'center', justifyContent: 'center', padding: '30px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1px' }}>
                    Metrika (Accuracy)
                  </label>
                  <div style={{ fontSize: '3.5rem', fontWeight: 'bold', color: 'var(--vut-red)', marginTop: '10px' }}>
                    {(selectedModel.accuracy * 100).toFixed(1)} %
                  </div>
                </div>

                <div className="detail-card" style={{ alignItems: 'center', justifyContent: 'center', padding: '30px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1px' }}>
                    Datum posledního tréninku
                  </label>
                  <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--text-main)', marginTop: '15px' }}>
                    {new Date(selectedModel.training_date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                  <div style={{ fontSize: '1rem', color: 'var(--text-muted)', marginTop: '5px' }}>
                    v {new Date(selectedModel.training_date).toLocaleTimeString('cs-CZ')}
                  </div>
                </div>
              </div>

              {/* SEKCE: TRÉNINK A FINE-TUNING */}
              <div style={{ marginBottom: '30px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '25px' }}>
                <h4 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-main)', borderBottom: 'none', marginBottom: '15px' }}>
                  🧠 Fine-Tuning a aktualizace modelu
                </h4>
                <p style={{ color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '20px' }}>
                  Baseline model je možné přetrénovat na reálných datech z provozu (Transfer Learning). 
                  Tím se model adaptuje na specifický šum a rezonanci vašich lokálních ložisek a strojů, což výrazně zvýší spolehlivost predikcí v produkčním prostředí.
                </p>
                
                <button 
                  className="btn-diagnose" 
                  onClick={() => setIsTrainingModalOpen(true)}
                  style={{ background: 'var(--vut-red)', padding: '12px 24px', fontSize: '1rem' }}
                >
                  ⚙️ Spustit přetrénování modelu
                </button>
              </div>

              {/* Sekce Popis */}
              <div style={{ marginBottom: '30px' }}>
                <h4 className="card-title">Popis a zaměření modelu</h4>
                <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', color: 'var(--text-main)', border: '1px solid #e2e8f0', lineHeight: 1.6 }}>
                  {selectedModel.description || 'Popis modelu není k dispozici.'}
                </div>
              </div>

              {/* Sekce Technické parametry */}
              <div>
                <h4 className="card-title">Technické parametry</h4>
                <div className="table-wrapper">
                  <table>
                    <tbody>
                      <tr>
                        <td style={{ color: 'var(--text-muted)', width: '30%', fontWeight: 600 }}>ID Modelu (Databáze)</td>
                        <td style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>#{selectedModel.id_model}</td>
                      </tr>
                      <tr>
                        <td style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Absolutní cesta k souboru</td>
                        <td>
                          <code style={{ background: '#f1f5f9', padding: '6px 10px', borderRadius: '4px', color: 'var(--vut-red)', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                            {selectedModel.path_to_model}
                          </code>
                        </td>
                      </tr>
                      <tr>
                        <td style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Typ architektury</td>
                        <td style={{ fontWeight: '600', color: 'var(--blue-primary)' }}>
                          {selectedModel.name.includes('Bi-LSTM') ? 'Recurrent Neural Network (RNN)' : 
                           selectedModel.name.includes('CNN') ? 'Convolutional Neural Network (1D)' : 
                           selectedModel.name.includes('GAN') ? 'Generative Adversarial Network' : 'Neznámá'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        ) : (
          <div className="detail-card" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)', minHeight: '500px' }}>
            <h2>Vyberte model ze seznamu vlevo pro zobrazení detailů.</h2>
          </div>
        )}
      </div>

      {/* MODAL PRO TRÉNINK */}
      {isTrainingModalOpen && selectedModel && (
        <ModelTrainingModal 
          model={selectedModel} 
          onClose={() => setIsTrainingModalOpen(false)} 
        />
      )}

    </div>
  );
}

export default MlSector;