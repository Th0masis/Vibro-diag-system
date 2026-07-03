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

  const getAuthHeader = () => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  };

  // Funkce vytažená ven z useEffect, abychom ji mohli volat po aktivaci nebo zavření modalu
  const fetchModels = async () => {
    try {
      const token = sessionStorage.getItem('token') || localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await axios.get('/ml-models', getAuthHeader());
      
      setModels(res.data);
      
      // Pokud už máme nějaký model vybraný, aktualizujeme jeho data (aby se přepsal is_active apod.)
      if (selectedModel) {
        const updatedSelected = res.data.find(m => m.id_model === selectedModel.id_model);
        if (updatedSelected) {
          setSelectedModel(updatedSelected);
        } else {
          // Pokud model z nějakého důvodu zmizel, vybereme první
          setSelectedModel(res.data.length > 0 ? res.data[0] : null);
        }
      } else if (res.data.length > 0) {
        setSelectedModel(res.data[0]);
      }
    } catch (err) {
      console.error("Chyba při načítání ML modelů", err);
      setError("Nepodařilo se načíst modely ze serveru. Zkontrolujte přihlášení.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Funkce pro nasazení modelu do produkce
  const handleActivateModel = async (id_model) => {
    if (!window.confirm("Opravdu chcete nasadit tuto verzi modelu do produkce? Tímto krokem se nahradí aktuálně běžící model.")) {
      return;
    }
    
    try {
      await axios.put(`/models/${id_model}/activate`, {}, getAuthHeader());
      
      alert("Model byl úspěšně aktivován a je nyní v produkci.");
      await fetchModels(); // Ihned po aktivaci stáhneme čerstvá data
    } catch (err) {
      console.error("Chyba při aktivaci modelu:", err);
      alert("Nepodařilo se aktivovat model. Zkontrolujte spojení s backendem.");
    }
  };
  
  if (loading && models.length === 0) return <div className="main-content">Načítám Machine Learning sektor...</div>;
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
            Správa prediktivních modelů | Aktivních v produkci: {models.filter(m => m.is_active).length}
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
              
              // Rozhodnutí, jaký štítek ukážeme vlevo
              let statusBadge;
              if (model.training_status === 'training') {
                statusBadge = <span className="role-badge" style={{ background: '#fef08a', color: '#854d0e', padding: '2px 8px', fontSize: '0.6rem' }}>TRÉNUJE SE ⏳</span>;
              } else if (model.is_active) {
                statusBadge = <span className="role-badge available" style={{ padding: '2px 8px', fontSize: '0.6rem' }}>AKTIVNÍ</span>;
              } else {
                statusBadge = <span className="role-badge STOPPED" style={{ padding: '2px 8px', fontSize: '0.6rem' }}>OFF</span>;
              }
              
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
                    {statusBadge}
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
              
              {/* ZDE JE LOGIKA PŘEPÍNACÍHO TLAČÍTKA A ŠTÍTKŮ */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
                {selectedModel.training_status === 'training' ? (
                  <span className="role-badge" style={{ background: '#fef08a', color: '#854d0e', fontSize: '0.85rem', padding: '6px 12px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                    ⏳ TRÉNUJE SE (čeká se na dokončení)
                  </span>
                ) : selectedModel.is_active ? (
                  <span className={`role-badge OK`} style={{ fontSize: '0.85rem', padding: '6px 12px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                    PRODUKČNÍ NASAZENÍ ✓
                  </span>
                ) : (
                  <button 
                    className="btn-update" 
                    onClick={() => handleActivateModel(selectedModel.id_model)}
                    style={{ background: 'white', color: 'var(--br-orange)', borderColor: 'white', fontSize: '0.9rem', padding: '8px 16px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', fontWeight: 'bold' }}
                  >
                    🚀 Aktivovat do produkce
                  </button>
                )}
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
                    {selectedModel.training_date ? new Date(selectedModel.training_date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Zatím netrénováno'}
                  </div>
                  <div style={{ fontSize: '1rem', color: 'var(--text-muted)', marginTop: '5px' }}>
                    {selectedModel.training_date ? `v ${new Date(selectedModel.training_date).toLocaleTimeString('cs-CZ')}` : '-'}
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
                  disabled={selectedModel.training_status === 'training'}
                  style={{ background: selectedModel.training_status === 'training' ? '#cbd5e1' : 'var(--vut-red)', padding: '12px 24px', fontSize: '1rem', cursor: selectedModel.training_status === 'training' ? 'not-allowed' : 'pointer' }}
                >
                  {selectedModel.training_status === 'training' ? 'Trénink právě probíhá...' : '⚙️ Spustit přetrénování modelu'}
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
                          <code style={{ background: '#f1f5f9', padding: '6px 10px', borderRadius: '4px', color: 'var(--vut-red)', fontFamily: 'monospace', fontSize: '0.9rem', wordBreak: 'break-all' }}>
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
          onClose={() => {
            setIsTrainingModalOpen(false);
            fetchModels(); // <- ZDE JE KLÍČ: po zavření modalu se nám obnoví data a vyskočí nový model "TRÉNUJE SE"
          }} 
        />
      )}

    </div>
  );
}

export default MlSector;