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
        console.error("Nepodařilo se načíst stroje a senzory", err);
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
      alert("Chyba: " + (error.response?.data?.detail || error.message));
      setStep(1);
    }
  };

  const renderSegmentSearch = () => (
    <div style={{ animation: 'fadeIn 0.3s' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h4 style={{ margin: 0, color: 'var(--text-main)' }}>Vyhledat data v databázi</h4>
        <button className="btn-cancel" onClick={() => setIsAddingSegment(false)}>← Zpět</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '10px', alignItems: 'end', background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>Stroj</label>
          <select className="custom-select" value={filters.machine} onChange={e => setFilters({...filters, machine: e.target.value, sensor: ''})}>
            <option value="">Všechny stroje</option>
            {availableMachines.map(m => <option key={m.id_machine} value={m.id_machine}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>Senzor</label>
          <select className="custom-select" value={filters.sensor} onChange={e => setFilters({...filters, sensor: e.target.value})}>
            <option value="">Všechny senzory</option>
            {filteredSensors.map(s => <option key={s.id_sensor} value={s.id_sensor}>{s.position || `Senzor #${s.id_sensor}`}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>Od</label>
          <input type="datetime-local" className="custom-select" value={filters.dateFrom} onChange={e => setFilters({...filters, dateFrom: e.target.value})} />
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>Do</label>
          <input type="datetime-local" className="custom-select" value={filters.dateTo} onChange={e => setFilters({...filters, dateTo: e.target.value})} />
        </div>
        <button className="btn-diagnose" onClick={handleSearchSegments} disabled={isSearching}>{isSearching ? '...' : 'Hledat'}</button>
      </div>

      <div className="table-wrapper" style={{ maxHeight: '250px', overflowY: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Stroj / Senzor</th>
              <th>Časový úsek</th>
              <th style={{ textAlign: 'center' }}>Vzorků</th>
              <th style={{ textAlign: 'center' }}>Akce</th>
            </tr>
          </thead>
          <tbody>
            {searchResults.map(res => {
              const isAdded = selectedSegments.find(s => s.id === res.id);
              return (
                <tr key={res.id}>
                  <td><strong>{res.machine}</strong><br/><small>{res.sensor}</small></td>
                  <td>{res.dateFrom}<br/>{res.dateTo}</td>
                  <td style={{ textAlign: 'center' }}><span className="role-badge user">{res.measurementsCount}</span></td>
                  <td style={{ textAlign: 'center' }}>
                    <button 
                        className="btn-update" 
                        style={{ padding: '4px 10px', fontSize: '0.8rem', opacity: isAdded ? 0.5 : 1 }}
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
      <div style={{ textAlign: 'left', marginTop: '20px' }}>
        
        {/* RUL SPECIFICKÁ DATA ŽIVOTNÍHO CYKLU */}
        {isRUL && (
          <div style={{ background: '#f0f9ff', padding: '20px', borderRadius: '8px', border: '1px solid #bae6fd', marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 15px 0', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '10px' }}>
              🕒 Parametry životního cyklu ložiska
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '5px' }}>Datum instalace (Start RUL = 1.0)</label>
                <input 
                  type="date" 
                  className="custom-select" 
                  style={{ width: '100%' }}
                  value={rulDates.installation}
                  onChange={e => setRulDates({...rulDates, installation: e.target.value})}
                />
                <small style={{ color: '#64748b' }}>Kdy bylo nové ložisko nasazeno do provozu.</small>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '5px' }}>Datum výměny/selhání (Konec RUL = 0.0)</label>
                <input 
                  type="date" 
                  className="custom-select" 
                  style={{ width: '100%' }}
                  value={rulDates.replacement}
                  onChange={e => setRulDates({...rulDates, replacement: e.target.value})}
                />
                <small style={{ color: '#64748b' }}>Okamžik, kdy ložisko dosáhlo konce životnosti.</small>
              </div>
            </div>
            <div style={{ marginTop: '15px', padding: '10px', background: '#e0f2fe', borderRadius: '5px', fontSize: '0.85rem' }}>
              <strong>Poznámka:</strong> Datum pořízení datového záznamu bude automaticky spárováno s tímto intervalem pro výpočet zbývající životnosti.
            </div>
          </div>
        )}

        {isCNN && (
          <div style={{ background: '#fff5f5', padding: '15px', borderRadius: '8px', border: '1px solid #fecaca', marginBottom: '20px' }}>
            <strong>Režim Supervised (Labelování)</strong><br/>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Přiřaďte úsekům typy poruch pro učení klasifikátoru.</span>
          </div>
        )}

        {isGAN && (
          <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
            <strong>Režim Unsupervised (Baseline)</strong><br/>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Vybírejte pouze úseky bezporuchového stavu stroje.</span>
          </div>
        )}

        {isAddingSegment ? renderSegmentSearch() : (
          <div style={{ animation: 'fadeIn 0.3s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h4 style={{ margin: 0 }}>Vybrané datové úseky</h4>
              <button className="btn-diagnose" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => setIsAddingSegment(true)}>+ Přidat data</button>
            </div>
            <div className="table-wrapper">
              {selectedSegments.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', background: 'white' }}>Žádná data. Vyhledejte úseky v databázi.</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Stroj / Senzor</th>
                      <th>Období měření</th>
                      <th style={{ textAlign: 'center' }}>Vzorků</th>
                      {isCNN && <th>Štítek (Label)</th>}
                      <th style={{ textAlign: 'center' }}>Odstranit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSegments.map(seg => (
                      <tr key={seg.id}>
                        <td><strong>{seg.machine}</strong><br/><small>{seg.sensor}</small></td>
                        <td>{new Date(seg.dateFrom).toLocaleString()}</td>
                        <td style={{ textAlign: 'center' }}><span className="role-badge user">{seg.measurementsCount}</span></td>
                        {isCNN && (
                          <td>
                            <select className="custom-select" style={{ padding: '4px' }} value={seg.label} onChange={e => setSelectedSegments(selectedSegments.map(s => s.id === seg.id ? {...s, label: e.target.value} : s))}>
                              {FAULT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                          </td>
                        )}
                        <td style={{ textAlign: 'center' }}>
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
      <div className="modal-content" style={{ maxWidth: '950px', width: '95%', padding: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: '15px' }}>
          <h2 style={{ margin: 0 }}>{step === 3 ? '🚀 Fine-Tuning' : '⚙️ Konfigurace tréninku'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
        </div>

        {step === 1 && (
          <div>
            <div style={{ marginTop: '20px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Model:</span>
              <h3 style={{ margin: '0', color: '#2563eb' }}>{model.name} <small>v{model.version}</small></h3>
            </div>
            {renderDataSelectionForm()}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px', marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
              <button className="btn-cancel" onClick={onClose}>Zrušit</button>
              <button className="btn-diagnose" style={{ background: 'var(--status-fault)' }} onClick={startTraining} disabled={selectedSegments.length === 0}>Spustit Fine-Tuning</button>
            </div>
          </div>
        )}

        {step === 2 && (
            <div style={{ padding: '60px 0', textAlign: 'center' }}>
                <div className="loading-spinner" style={{ margin: '0 auto 20px' }}></div>
                <h3>{trainingPhase}</h3>
            </div>
        )}

        {step === 3 && (
          <div style={{ padding: '40px 0', textAlign: 'center' }}>
            <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🚀</div>
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