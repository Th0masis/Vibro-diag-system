import { useState, useEffect } from 'react';
import axios from 'axios';

function ModelTrainingModal({ model, onClose }) {
  const [step, setStep] = useState(1);
  const [trainingPhase, setTrainingPhase] = useState('');

  // --- STAVY PRO VÝBĚR DAT ---
  const [isAddingSegment, setIsAddingSegment] = useState(false);
  const [selectedSegments, setSelectedSegments] = useState([]);
  
  // Stavy pro RUL specifika
  const [rulDates, setRulDates] = useState({ installation: '', replacement: '' });

  // Stavy pro filtry a vyhledávání
  const [filters, setFilters] = useState({ machine: '', sensor: '', dateFrom: '', dateTo: '' });
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Stavy pro dynamické dropdowny
  const [availableMachines, setAvailableMachines] = useState([]);
  const [allSensors, setAllSensors] = useState([]);

  const isRUL = model.name.includes('Bi-LSTM') || model.type === 'Bi-LSTM';
  const isCNN = model.name.includes('CNN') || model.type === '1D_CNN';
  const isGAN = model.name.includes('GAN') || model.type === 'AE_ANOWGAN';

  const FAULT_OPTIONS = [
    { value: '0', label: 'Zdravé ložisko (Normal)' },
    { value: '1', label: 'Porucha vnitřního kroužku (IR)' },
    { value: '2', label: 'Porucha vnějšího kroužku (OR)' },
    { value: '3', label: 'Porucha valivého elementu / klece - other (O)' }
  ];

  const getAuthHeader = () => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    const fetchFiltersData = async () => {
      try {
        const headers = getAuthHeader();
        const [machRes, sensRes] = await Promise.all([
          axios.get('/machines', { headers }),
          axios.get('/sensors', { headers })
        ]);
        setAvailableMachines(machRes.data);
        setAllSensors(sensRes.data);
      } catch (err) {
      console.error('Failed to load machines and sensors:', err);
      }
    };
    fetchFiltersData();
  }, []);

  const filteredSensors = filters.machine 
    ? allSensors.filter(s => s.id_machine != null && s.id_machine.toString() === filters.machine.toString())
    : allSensors;

  const handleSearchSegments = async () => {
    setIsSearching(true);
    try {
      const params = new URLSearchParams();
      if (filters.machine) params.append('machine_id', filters.machine);
      if (filters.sensor) params.append('sensor_id', filters.sensor);
      if (filters.dateFrom) params.append('datetime_from', filters.dateFrom);
      if (filters.dateTo) params.append('datetime_to', filters.dateTo);

      const headers = getAuthHeader();
      const response = await axios.get(`/training-segments?${params.toString()}`, { headers });
      setSearchResults(response.data);
    } catch (error) {
      console.error("Chyba při vyhledávání dat:", error);
      alert("Nepodařilo se vyhledat datové úseky.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddSegment = (segment) => {
    if (!selectedSegments.find(s => s.id === segment.id)) {
      setSelectedSegments([...selectedSegments, { ...segment, label: '0' }]);
    }
  };

  const startTraining = async () => {
    if (selectedSegments.length === 0) {
      alert("Pro trénink musíte vybrat alespoň jeden datový úsek!");
      return;
    }

    if (isRUL && (!rulDates.installation || !rulDates.replacement)) {
      alert("Pro trénink RUL modelu musíte zadat datum instalace a datum výměny (selhání) ložiska!");
      return;
    }

    setStep(2);
    setTrainingPhase('Odesílám data na server a spouštím MLOps pipeline...');

    try {
      const headers = getAuthHeader();
      const payload = {
        segments: selectedSegments.map(seg => {
          const [mId, sId] = seg.id.split('_');
          return {
            id_machine: parseInt(mId),
            id_sensor: parseInt(sId),
            dateFrom: seg.dateFrom,
            dateTo: seg.dateTo,
            label: isCNN ? parseInt(seg.label) : null
          };
        }),
        // Přidání časových metrik životního cyklu pro RUL
        lifecycle_info: isRUL ? {
          installed_at: rulDates.installation,
          failed_at: rulDates.replacement
        } : null
      };

      await axios.post(`/models/${model.id_model}/fine-tune`, payload, { headers });
      setStep(3);
    } catch (error) {
      console.error("Chyba při spouštění tréninku:", error);
      alert("Error: " + (error.response?.data?.detail || error.message));
      setStep(1);
    }
  };

  const renderSegmentSearch = () => (
    <div className="training-search-root">
      <div className="training-search-header">
        <h4 className="training-search-title">Vyhledat data v databázi</h4>
        <button className="btn-cancel" onClick={() => setIsAddingSegment(false)}>← Back</button>
      </div>

      <div className="training-search-filters">
        <div>
          <label className="training-field-label">Stroj</label>
          <select className="custom-select" value={filters.machine} onChange={e => setFilters({...filters, machine: e.target.value, sensor: ''})}>
            <option value="">Všechny stroje</option>
            {availableMachines.map(m => <option key={m.id_machine} value={m.id_machine}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label className="training-field-label">Senzor</label>
          <select className="custom-select" value={filters.sensor} onChange={e => setFilters({...filters, sensor: e.target.value})}>
            <option value="">All sensors</option>
            {filteredSensors.map(s => <option key={s.id_sensor} value={s.id_sensor}>{s.position || `Senzor #${s.id_sensor}`}</option>)}
          </select>
        </div>
        <div>
          <label className="training-field-label">Od</label>
          <input type="datetime-local" className="custom-select" value={filters.dateFrom} onChange={e => setFilters({...filters, dateFrom: e.target.value})} />
        </div>
        <div>
          <label className="training-field-label">Do</label>
          <input type="datetime-local" className="custom-select" value={filters.dateTo} onChange={e => setFilters({...filters, dateTo: e.target.value})} />
        </div>
        <button className="btn-diagnose" onClick={handleSearchSegments} disabled={isSearching}>{isSearching ? '...' : 'Search'}</button>
      </div>

      <div className="table-wrapper training-search-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Stroj / Senzor</th>
              <th>Časový úsek</th>
              <th className="training-center">Vzorků</th>
              <th className="training-center">Akce</th>
            </tr>
          </thead>
          <tbody>
            {searchResults.map(res => {
              const isAdded = selectedSegments.find(s => s.id === res.id);
              return (
                <tr key={res.id}>
                  <td><strong>{res.machine}</strong><br/><small>{res.sensor}</small></td>
                  <td>{res.dateFrom}<br/>{res.dateTo}</td>
                  <td className="training-center"><span className="role-badge user">{res.measurementsCount}</span></td>
                  <td className="training-center">
                    <button 
                        className={`btn-update training-add-btn ${isAdded ? 'training-add-btn--added' : ''}`}
                        onClick={() => handleAddSegment(res)}
                        disabled={isAdded}
                    >
                      {isAdded ? 'Přidáno ✓' : '+ Přidat'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderDataSelectionForm = () => {
    return (
      <div className="training-form-root">
        
        {/* RUL SPECIFICKÁ DATA ŽIVOTNÍHO CYKLU */}
        {isRUL && (
          <div className="training-rul-box">
            <h4 className="training-rul-title">
              🕒 Parametry životního cyklu ložiska
            </h4>
            <div className="training-rul-grid">
              <div>
                <label className="training-rul-label">Datum instalace (Start RUL = 1.0)</label>
                <input 
                  type="date" 
                  className="custom-select training-rul-input"
                  value={rulDates.installation}
                  onChange={e => setRulDates({...rulDates, installation: e.target.value})}
                />
                <small className="training-help">Kdy bylo nové ložisko nasazeno do provozu.</small>
              </div>
              <div>
                <label className="training-rul-label">Datum výměny/selhání (Konec RUL = 0.0)</label>
                <input 
                  type="date" 
                  className="custom-select training-rul-input"
                  value={rulDates.replacement}
                  onChange={e => setRulDates({...rulDates, replacement: e.target.value})}
                />
                <small className="training-help">Okamžik, kdy ložisko dosáhlo konce životnosti.</small>
              </div>
            </div>
            <div className="training-rul-note">
              <strong>Poznámka:</strong> Datum pořízení datového záznamu bude automaticky spárováno s tímto intervalem pro výpočet zbývající životnosti.
            </div>
          </div>
        )}

        {isCNN && (
          <div className="training-mode-box training-mode-box--cnn">
            <strong>Režim Supervised (Labelování)</strong><br/>
            <span className="training-mode-text">Přiřaďte úsekům typy poruch pro učení klasifikátoru.</span>
          </div>
        )}

        {isGAN && (
          <div className="training-mode-box training-mode-box--gan">
            <strong>Režim Unsupervised (Baseline)</strong><br/>
            <span className="training-mode-text">Vybírejte pouze úseky bezporuchového stavu stroje.</span>
          </div>
        )}

        {isAddingSegment ? renderSegmentSearch() : (
          <div className="training-selected-root">
            <div className="training-selected-header">
              <h4 className="training-selected-title">Vybrané datové úseky</h4>
              <button className="btn-diagnose training-add-data-btn" onClick={() => setIsAddingSegment(true)}>+ Přidat data</button>
            </div>
            <div className="table-wrapper">
              {selectedSegments.length === 0 ? (
                <div className="training-empty">Žádná data. Vyhledejte úseky v databázi.</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Stroj / Senzor</th>
                      <th>Období měření</th>
                      <th className="training-center">Vzorků</th>
                      {isCNN && <th>Štítek (Label)</th>}
                      <th className="training-center">Odstranit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSegments.map(seg => (
                      <tr key={seg.id}>
                        <td><strong>{seg.machine}</strong><br/><small>{seg.sensor}</small></td>
                        <td>{new Date(seg.dateFrom).toLocaleString()}</td>
                        <td className="training-center"><span className="role-badge user">{seg.measurementsCount}</span></td>
                        {isCNN && (
                          <td>
                            <select className="custom-select training-label-select" value={seg.label} onChange={e => setSelectedSegments(selectedSegments.map(s => s.id === seg.id ? {...s, label: e.target.value} : s))}>
                              {FAULT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                          </td>
                        )}
                        <td className="training-center">
                          <button className="btn-small-delete" onClick={() => setSelectedSegments(selectedSegments.filter(s => s.id !== seg.id))}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content training-modal-content">
        <div className="training-modal-header">
          <h2 className="training-modal-title">{step === 3 ? '🚀 Fine-Tuning' : '⚙️ Konfigurace tréninku'}</h2>
          <button onClick={onClose} className="modal-close-btn modal-close-btn--dark" title="Close">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {step === 1 && (
          <div>
            <div className="training-model-meta">
              <span className="training-model-label">Model:</span>
              <h3 className="training-model-name">{model.name} <small>v{model.version}</small></h3>
            </div>
            {renderDataSelectionForm()}
            <div className="training-modal-actions">
              <button className="btn-cancel" onClick={onClose}>Zrušit</button>
              <button className="btn-diagnose training-start-btn" onClick={startTraining} disabled={selectedSegments.length === 0}>Spustit Fine-Tuning</button>
            </div>
          </div>
        )}

        {step === 2 && (
            <div className="training-step-center training-step-center--loading">
                <div className="loading-spinner training-step-spinner"></div>
                <h3>{trainingPhase}</h3>
            </div>
        )}

        {step === 3 && (
          <div className="training-step-center training-step-center--done">
            <div className="training-success-icon">🚀</div>
            <h3>Pipeline úspěšně inicializována</h3>
            <p>Trénink probíhá asynchronně. Status modelu v DB: <strong>TRAINING</strong>.</p>
            <button className="btn-diagnose" onClick={onClose}>Zavřít</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ModelTrainingModal;