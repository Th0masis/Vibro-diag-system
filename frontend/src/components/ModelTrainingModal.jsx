import { useState, useEffect } from 'react';
import axios from 'axios';

function ModelTrainingModal({ model, onClose }) {
  const [step, setStep] = useState(1);
  const [trainingPhase, setTrainingPhase] = useState('');

  // --- STAVY PRO VÝBĚR DAT ---
  const [isAddingSegment, setIsAddingSegment] = useState(false);
  const [selectedSegments, setSelectedSegments] = useState([]);
  
  // Stavy pro filtry a vyhledávání
  const [filters, setFilters] = useState({ machine: '', sensor: '', dateFrom: '', dateTo: '' });
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Stavy pro dynamické dropdowny
  const [availableMachines, setAvailableMachines] = useState([]);
  const [allSensors, setAllSensors] = useState([]);

  // Možnosti štítků pro CNN
  const FAULT_OPTIONS = [
    { value: '0', label: 'Zdravé ložisko (Normal)' },
    { value: '1', label: 'Porucha vnitřního kroužku (IR)' },
    { value: '2', label: 'Porucha vnějšího kroužku (OR)' },
    { value: '3', label: 'Porucha valivého elementu (Ball)' },
    { value: '4', label: 'Porucha klece (Cage)' }
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

  const handleMachineChange = (e) => {
    setFilters({ ...filters, machine: e.target.value, sensor: '' });
  };

  const handleSearchSegments = async () => {
    setIsSearching(true);
    try {
      const params = new URLSearchParams();
      if (filters.machine) params.append('machine_id', filters.machine);
      if (filters.sensor) params.append('sensor_id', filters.sensor);
      if (filters.dateFrom) params.append('datetime_from', filters.dateFrom);
      if (filters.dateTo) params.append('datetime_to', filters.dateTo);

      const headers = getAuthHeader();
      const response = await axios.get(`http://127.0.0.1:8000/training-segments?${params.toString()}`, { headers });
      setSearchResults(response.data);
    } catch (error) {
      console.error("Chyba při vyhledávání dat:", error);
      alert("Nepodařilo se vyhledat datové úseky ze serveru.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddSegment = (segment) => {
    if (!selectedSegments.find(s => s.id === segment.id)) {
      // Přidáme úsek s výchozím labelem '0', použije se pouze u CNN
      setSelectedSegments([...selectedSegments, { ...segment, label: '0' }]);
    }
  };

  const handleRemoveSegment = (segmentId) => {
    setSelectedSegments(selectedSegments.filter(s => s.id !== segmentId));
  };

  const handleLabelChange = (segmentId, newLabel) => {
    setSelectedSegments(selectedSegments.map(s => 
      s.id === segmentId ? { ...s, label: newLabel } : s
    ));
  };

  const startTraining = async () => {
    if (selectedSegments.length === 0) {
      alert("Pro trénink musíte vybrat alespoň jeden datový úsek!");
      return;
    }

    setStep(2);
    setTrainingPhase('Odesílám data na server a spouštím MLOps pipeline...');

    try {
      const headers = getAuthHeader();
      
      // Sestavení payloadu - musíme rozdělit náš React klíč 'id' zpět na id_machine a id_sensor
      const payloadSegments = selectedSegments.map(seg => {
        const [machineStr, sensorStr] = seg.id.split('_');
        return {
          id_machine: parseInt(machineStr),
          id_sensor: parseInt(sensorStr),
          dateFrom: seg.dateFrom,
          dateTo: seg.dateTo,
          label: seg.label || null // Label se pošle jen u CNN, u GAN/RUL bude null
        };
      });

      // Reálné odeslání na backend
      await axios.post(
        `http://127.0.0.1:8000/models/${model.id_model}/fine-tune`,
        { segments: payloadSegments },
        { headers }
      );

      // Pokud backend odpoví 200/202, jdeme na krok 3
      setStep(3);

    } catch (error) {
      console.error("Chyba při spouštění tréninku:", error);
      alert("Nepodařilo se spustit trénink: " + (error.response?.data?.detail || error.message));
      setStep(1); // Vrátíme uživatele zpět k výběru dat
    }
  };

  // --- VYKRESLENÍ: HLEDÁNÍ A PŘIDÁVÁNÍ DATOVÝCH ÚSEKŮ ---
  const renderSegmentSearch = () => (
    <div style={{ animation: 'fadeIn 0.3s' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h4 style={{ margin: 0, color: 'var(--text-main)' }}>Vyhledat data v databázi</h4>
        <button className="btn-cancel" onClick={() => setIsAddingSegment(false)}>← Zpět na přehled</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '10px', alignItems: 'end', background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>Stroj</label>
          <select className="custom-select" style={{ width: '100%', padding: '8px' }} value={filters.machine} onChange={handleMachineChange}>
            <option value="">Všechny stroje</option>
            {availableMachines.map(m => (
              <option key={m.id_machine} value={m.id_machine}>{m.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>Senzor</label>
          <select className="custom-select" style={{ width: '100%', padding: '8px' }} value={filters.sensor} onChange={e => setFilters({...filters, sensor: e.target.value})}>
            <option value="">Všechny senzory</option>
            {filteredSensors.map(s => (
              <option key={s.id_sensor} value={s.id_sensor}>
                {s.position ? s.position : `Senzor #${s.id_sensor}`}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>Od (Přesný čas)</label>
          <input type="datetime-local" className="custom-select" style={{ width: '100%', padding: '8px' }} value={filters.dateFrom} onChange={e => setFilters({...filters, dateFrom: e.target.value})} />
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>Do (Přesný čas)</label>
          <input type="datetime-local" className="custom-select" style={{ width: '100%', padding: '8px' }} value={filters.dateTo} onChange={e => setFilters({...filters, dateTo: e.target.value})} />
        </div>
        <button className="btn-diagnose" style={{ padding: '8px 15px' }} onClick={handleSearchSegments} disabled={isSearching}>
          {isSearching ? '...' : 'Hledat'}
        </button>
      </div>

      {searchResults.length > 0 ? (
        <div className="table-wrapper" style={{ maxHeight: '250px', overflowY: 'auto' }}>
          <table style={{ fontSize: '0.9rem' }}>
            <thead>
              <tr>
                <th style={{ padding: '10px' }}>Stroj / Senzor</th>
                <th style={{ padding: '10px' }}>Časový úsek</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>Měření</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>Akce</th>
              </tr>
            </thead>
            <tbody>
              {searchResults.map(res => {
                const isAdded = selectedSegments.find(s => s.id === res.id);
                return (
                  <tr key={res.id}>
                    <td style={{ padding: '10px' }}><strong>{res.machine}</strong><br/><span style={{ color: 'var(--text-muted)' }}>{res.sensor}</span></td>
                    <td style={{ padding: '10px' }}>{res.dateFrom} <br/> {res.dateTo}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      <span className="role-badge user">{res.measurementsCount}</span>
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      <button 
                        className="btn-update" 
                        style={{ padding: '4px 10px', fontSize: '0.8rem', background: isAdded ? '#f1f5f9' : 'white', borderColor: isAdded ? '#cbd5e1' : 'var(--br-orange)', color: isAdded ? '#94a3b8' : 'var(--br-orange)' }}
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
      ) : (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
          {isSearching ? 'Hledám data v databázi...' : 'Žádné výsledky hledání. Upravte filtry a klikněte na Hledat.'}
        </div>
      )}
    </div>
  );

  // --- SPOLEČNÝ FORMULÁŘ PRO VÝBĚR DAT (Všechny 3 modely) ---
  const renderDataSelectionForm = () => {
    const isCNN = model.name.includes('CNN');
    const isRUL = model.name.includes('Bi-LSTM');
    const isGAN = model.name.includes('GAN');
    
    return (
      <div style={{ textAlign: 'left', marginTop: '20px' }}>
        
        {/* INFO BOX PODLE TYPU MODELU */}
        {isCNN && (
          <div style={{ background: '#fff5f5', padding: '15px', borderRadius: '8px', borderLeft: '4px solid var(--vut-red)', marginBottom: '20px' }}>
            <strong>Režim Supervised (Labelování dat)</strong><br/>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Model 1D_CNN vyžaduje oštítkovaná (labeled) data. Vyberte datové úseky z databáze a v tabulce jim přiřaďte správný typ poruchy (nebo zdravý stav). Model se na nich doučí novým vzorcům.
            </span>
          </div>
        )}
        
        {isGAN && (
          <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', borderLeft: '4px solid var(--br-orange)', marginBottom: '20px' }}>
            <strong>Režim Unsupervised (Zdravá data)</strong><br/>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Model AE_ANOWGAN vyžaduje výhradně <strong>zdravá data</strong>. Vyberte úseky, kdy stroj prokazatelně běžel bez závad. Síť si z nich vytvoří novou baseline.
            </span>
          </div>
        )}

        {isRUL && (
          <div style={{ background: '#f0f9ff', padding: '15px', borderRadius: '8px', borderLeft: '4px solid var(--blue-primary)', marginBottom: '20px' }}>
            <strong>Predikce životnosti (Run-to-Failure data)</strong><br/>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Tento Bi-LSTM model potřebuje sledovat degradaci v čase. Pro dosažení nejlepších výsledků filtrujte souvislé časové úseky <strong>od zdravého stavu až do selhání či výměny ložiska</strong>.
            </span>
          </div>
        )}

        {isAddingSegment ? (
          renderSegmentSearch()
        ) : (
          <div style={{ animation: 'fadeIn 0.3s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h4 style={{ margin: 0, color: 'var(--text-main)' }}>Datové úseky pro trénink</h4>
              <button className="btn-diagnose" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => setIsAddingSegment(true)}>
                + Hledat data v DB
              </button>
            </div>

            <div className="table-wrapper">
              {selectedSegments.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', background: 'white' }}>
                  Zatím nebyly vybrány žádné datové úseky. <br/>Klikněte na tlačítko výše pro výběr dat z databáze.
                </div>
              ) : (
                <table style={{ fontSize: '0.9rem' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '10px' }}>Stroj / Senzor</th>
                      <th style={{ padding: '10px' }}>Období</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Vzorků</th>
                      {isCNN && <th style={{ padding: '10px' }}>Typ poruchy (Label)</th>}
                      <th style={{ padding: '10px', textAlign: 'center' }}>Odstranit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSegments.map(seg => (
                      <tr key={seg.id}>
                        <td style={{ padding: '10px' }}><strong>{seg.machine}</strong><br/><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{seg.sensor}</span></td>
                        <td style={{ padding: '10px' }}>{seg.dateFrom} - {seg.dateTo}</td>
                        <td style={{ padding: '10px', textAlign: 'center' }}><span className="role-badge user">{seg.measurementsCount}</span></td>
                        
                        {/* ROLETKA PRO ŠTÍTKOVÁNÍ POUZE U CNN */}
                        {isCNN && (
                          <td style={{ padding: '10px' }}>
                            <select 
                              className="custom-select" 
                              style={{ width: '100%', padding: '6px', fontSize: '0.85rem' }}
                              value={seg.label}
                              onChange={(e) => handleLabelChange(seg.id, e.target.value)}
                            >
                              {FAULT_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </td>
                        )}

                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          <button className="btn-small-delete" onClick={() => handleRemoveSegment(seg.id)}>✕</button>
                        </td>
                      </tr>
                    ))}
                    <tr style={{ background: '#f8fafc', fontWeight: 'bold' }}>
                      <td colSpan="2" style={{ padding: '10px', textAlign: 'right' }}>Celkem vzorků k tréninku:</td>
                      <td style={{ padding: '10px', textAlign: 'center', color: 'var(--br-orange)' }}>
                        {selectedSegments.reduce((acc, curr) => acc + curr.measurementsCount, 0)}
                      </td>
                      {isCNN && <td></td>}
                      <td></td>
                    </tr>
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
      <div className="modal-content" style={{ maxWidth: '900px', width: '95%', padding: '30px' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: '15px' }}>
          <h2 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.5rem' }}>
            {step === 3 ? '🚀 Trénink spuštěn' : '⚙️ Přetrénování modelu'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#94a3b8' }}>&times;</button>
        </div>

        {step === 1 && (
          <div>
            <div style={{ marginTop: '20px', textAlign: 'left' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Vybraný model:</span>
              <h3 style={{ margin: '5px 0 0 0', color: 'var(--blue-primary)' }}>{model.name} <span style={{ fontSize: '0.9rem', color: '#64748b' }}>v{model.version}</span></h3>
            </div>

            {/* Zde se renderuje společný formulář pro všechny 3 modely */}
            {renderDataSelectionForm()}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px', marginTop: '30px', borderTop: '1px solid #f1f5f9', paddingTop: '20px' }}>
              <button className="btn-cancel" onClick={onClose} disabled={isAddingSegment}>Zrušit</button>
              <button 
                className="btn-diagnose" 
                style={{ background: 'var(--vut-red)' }} 
                onClick={startTraining}
                disabled={isAddingSegment || selectedSegments.length === 0}
              >
                Spustit Fine-Tuning
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ padding: '50px 0', textAlign: 'center' }}>
            <div style={{ width: '60px', height: '60px', border: '5px solid #e2e8f0', borderTop: '5px solid var(--vut-red)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 25px auto' }}></div>
            <h3 style={{ color: 'var(--text-main)', fontSize: '1.4rem' }}>Komunikuji s backendem...</h3>
            <p style={{ color: 'var(--br-orange)', fontWeight: 'bold', fontSize: '1.1rem', marginTop: '10px' }}>{trainingPhase}</p>
          </div>
        )}

        {step === 3 && (
          <div style={{ padding: '40px 0', textAlign: 'center' }}>
            <div style={{ fontSize: '5rem', color: '#16a34a', marginBottom: '15px' }}>🚀</div>
            <h3 style={{ color: 'var(--text-main)', fontSize: '1.5rem', marginBottom: '10px' }}>Trénink byl spuštěn na pozadí!</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '30px', fontSize: '1.1rem' }}>
              Data byla předána ML servise. Stav modelu v databázi byl změněn na <strong>"TRAINING"</strong>. <br/>
              Až bude proces dokončen, systém se automaticky aktualizuje.
            </p>
            <button className="btn-diagnose" onClick={onClose} style={{ width: '100%', maxWidth: '300px' }}>Zavřít a vrátit se do katalogu</button>
          </div>
        )}

      </div>
    </div>
  );
}

export default ModelTrainingModal;