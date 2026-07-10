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
    // axios defaults are already set by App.jsx, just use them
    return { withCredentials: true };
  };

  // Funkce vytažená ven z useEffect, abychom ji mohli volat po aktivaci nebo zavření modalu
  const fetchModels = async () => {
    try {
      const config = getAuthHeader();
      const res = await axios.get('/ml-models', config);
      
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
      console.error('Failed to load ML models', err);
      setError("Failed to load models from server. Check your login.");
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
    if (!window.confirm("Are you sure you want to deploy this model version to production? This will replace the currently running model.")) {
      return;
    }
    
    try {
      await axios.put(`/models/${id_model}/activate`, {}, getAuthHeader());
      
      alert("Model activated successfully and is now in production.");
      await fetchModels(); // Ihned po aktivaci stáhneme čerstvá data
    } catch (err) {
      console.error('Failed to activate model:', err);
      alert("Failed to activate model. Check backend connection.");
    }
  };
  
  if (loading && models.length === 0) return <div className="main-content">Loading ML sector...</div>;
  if (error) return <div className="main-content ml-sector-error">{error}</div>;

  return (
    <div className="main-content ml-sector-page">
      
      {/* HLAVIČKA STRÁNKY */}
      <div className="machine-header-container ml-sector-header">
        <div className="machine-title-section">
          <h1>
            <span className="ml-sector-title-text">AI Models</span>
          </h1>
          <div className="machine-meta">
            Predictive model management | Active in production: {models.filter(m => m.is_active).length}
          </div>
        </div>
      </div>

      <div className="ml-sector-layout">
        
        {/* LEVÝ PANEL: SEZNAM MODELŮ */}
        <div className="detail-card card-tech ml-sector-catalog-card">
          <div className="ml-sector-catalog-header">
            <h3 className="card-title ml-sector-catalog-title">Model catalog</h3>
          </div>
          
          <div className="ml-sector-catalog-list">
            {models.map(model => {
              const isSelected = selectedModel?.id_model === model.id_model;
              
              // Rozhodnutí, jaký štítek ukážeme vlevo
              let statusBadge;
              if (model.training_status === 'training') {
                statusBadge = <span className="role-badge ml-model-status-badge ml-model-status-badge--training">TRAINING</span>;
              } else if (model.is_active) {
                statusBadge = <span className="role-badge available ml-model-status-badge">ACTIVE</span>;
              } else {
                statusBadge = <span className="role-badge STOPPED ml-model-status-badge">OFF</span>;
              }
              
              return (
                <button 
                  key={model.id_model}
                  onClick={() => setSelectedModel(model)}
                  className={`ml-model-list-item ${isSelected ? 'is-selected' : ''}`}
                >
                  <div className="ml-model-list-item-top">
                    <span className={`ml-model-list-item-name ${isSelected ? 'is-selected' : ''}`}>
                      {model.name} 
                      <span className="ml-model-list-item-version">
                        v{model.version}
                      </span>
                    </span>
                    {statusBadge}
                  </div>
                  <span className="ml-model-list-item-type">{model.type}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* PRAVÝ PANEL: DETAIL VYBRANÉHO MODELU */}
        {selectedModel ? (
          <div className="detail-card card-sensors ml-sector-detail-card">
            
            {/* Barevná hlavička detailu */}
            <div className="ml-sector-detail-header">
              <div>
                <div className="ml-sector-detail-header-main">
                  <h2 className="ml-sector-detail-model-name">{selectedModel.name}</h2>
                  <span className="role-badge ml-sector-detail-version-badge">
                    v{selectedModel.version}
                  </span>
                </div>
                <p className="ml-sector-detail-model-type">{selectedModel.type}</p>
              </div>
              <div className="ml-sector-detail-cta-wrap">
                {selectedModel.training_status === 'training' ? (
                  <span className="role-badge ml-sector-training-badge">
                    TRAINING (waiting to complete)
                  </span>
                ) : selectedModel.is_active ? (
                  <span className="role-badge OK ml-sector-production-badge">
                    PRODUCTION
                  </span>
                ) : (
                  <button
                    className="btn-update ml-sector-activate-btn"
                    onClick={() => handleActivateModel(selectedModel.id_model)}
                  >
                    Deploy to production
                  </button>
                )}
              </div>
            </div>
            {/* Tělo detailu */}
            <div className="ml-sector-detail-body">
              
              <div className="detail-grid ml-sector-metrics-grid">
                <div className="detail-card ml-sector-metric-card">
                  <label className="ml-sector-metric-label">
                    Accuracy metric
                  </label>
                  <div className="ml-sector-metric-value">
                    {(selectedModel.accuracy * 100).toFixed(1)} %
                  </div>
                </div>

                <div className="detail-card ml-sector-metric-card">
                  <label className="ml-sector-metric-label">
                    Last trained
                  </label>
                  <div className="ml-sector-date-main">
                    {selectedModel.training_date ? new Date(selectedModel.training_date).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Not yet trained'}
                  </div>
                  <div className="ml-sector-date-sub">
                    {selectedModel.training_date ? `at ${new Date(selectedModel.training_date).toLocaleTimeString('en-US')}` : '-'}
                  </div>
                </div>
              </div>

              {/* SEKCE: TRÉNINK A FINE-TUNING */}
              <div className="ml-sector-training-box">
                <h4 className="card-title ml-sector-training-title">
                  Fine-Tune & Update Model
                </h4>
                <p className="ml-sector-training-description">
                  The baseline model can be fine-tuned on real production data (Transfer Learning). This adapts the model to your specific equipment noise and bearing characteristics, significantly improving prediction reliability in production.
                </p>
                
                <button
                  className={`btn-diagnose ml-sector-train-btn ${selectedModel.training_status === 'training' ? 'is-disabled' : ''}`}
                  onClick={() => setIsTrainingModalOpen(true)}
                  disabled={selectedModel.training_status === 'training'}
                >
                  {selectedModel.training_status === 'training' ? 'Training in progress...' : 'Start fine-tuning'}
                </button>
              </div>

              {/* Sekce Popis */}
              <div className="ml-sector-section-block">
                <h4 className="card-title">Model description</h4>
                <div className="ml-sector-description-box">
                  {selectedModel.description || 'Model description not available.'}
                </div>
              </div>

              {/* Sekce Technické parametry */}
              <div>
                <h4 className="card-title">Technical parameters</h4>
                <div className="table-wrapper">
                  <table>
                    <tbody>
                      <tr>
                        <td className="ml-sector-param-key ml-sector-param-key--narrow">Model ID (Database)</td>
                        <td className="ml-sector-param-value">#{selectedModel.id_model}</td>
                      </tr>
                      <tr>
                        <td className="ml-sector-param-key">Absolute file path</td>
                        <td>
                          <code className="ml-sector-model-path">
                            {selectedModel.path_to_model}
                          </code>
                        </td>
                      </tr>
                      <tr>
                        <td className="ml-sector-param-key">Architecture type</td>
                        <td className="ml-sector-arch-value">
                          {selectedModel.name.includes('Bi-LSTM') ? 'Recurrent Neural Network (RNN)' : 
                           selectedModel.name.includes('CNN') ? 'Convolutional Neural Network (1D)' : 
                           selectedModel.name.includes('GAN') ? 'Generative Adversarial Network' : 'Unknown'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        ) : (
          <div className="detail-card ml-sector-empty-state">
            <h2>Select a model from the list to view details.</h2>
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