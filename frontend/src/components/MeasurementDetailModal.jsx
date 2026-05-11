import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine 
} from 'recharts';

function MeasurementDetailModal({ measurementId, onClose, onProcessed }) {
  // --- ZÁKLADNÍ STAVY ---
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState(null); 
  const [rawData, setRawData] = useState([]);   
  const [isProcessing, setIsProcessing] = useState(false);
  
  // --- STAVY PRO ROZŠÍŘENOU VIZUALIZACI ---
  const [activeTab, setActiveTab] = useState('time'); // 'time', 'fft', 'cwt'
  const [fftData, setFftData] = useState([]);
  const [cwtImage, setCwtImage] = useState(null);
  const [loadingViz, setLoadingViz] = useState(false);

  // XJTU-SY sampling parameters
  const SAMPLING_FREQ = 25600; 
  const DOWNSAMPLE_STEP = 16;  

  // 1. Načtení základu (Časový signál + Vypočtené parametry)
  const fetchDetail = async () => {
    try {
      setLoading(true);
      
      const rawRes = await axios.get(`/measurements/${measurementId}/raw`);
      
      let featResData = null;
      try {
        const featRes = await axios.get(`/measurements/${measurementId}/features`);
        featResData = featRes.data; 
      } catch (e) {
        console.log("Features zatím neexistují.");
      }

      const signalData = Array.isArray(rawRes.data) ? rawRes.data : rawRes.data.signal;
      
      const formattedRaw = signalData.map((val, idx) => ({
        time: ((idx * DOWNSAMPLE_STEP) / SAMPLING_FREQ * 1000).toFixed(1), 
        v: val
      }));
      
      setRawData(formattedRaw);
      setDetails(featResData);
      
    } catch (error) {
      console.error("Chyba detailu:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (measurementId) fetchDetail();
  }, [measurementId]);

  // 2. Načtení FFT a CWT podle aktivní záložky
  useEffect(() => {
    const fetchAdvancedViz = async () => {
      setLoadingViz(true);
      try {
        if (activeTab === 'fft' && fftData.length === 0) {
          const res = await axios.get(`http://127.0.0.1:8000/measurements/${measurementId}/fft`);
          const formattedFft = res.data.frequencies.map((freq, i) => ({
            freq: freq,
            amp: res.data.amplitudes[i]
          }));
          setFftData(formattedFft);
        } 
        else if (activeTab === 'cwt' && !cwtImage) {
          const res = await axios.get(`http://127.0.0.1:8000/measurements/${measurementId}/cwt`);
          setCwtImage(res.data.cwt_image);
        }
      } catch (err) {
        console.error(`Chyba načítání ${activeTab}:`, err);
      } finally {
        setLoadingViz(false);
      }
    };

    if (activeTab !== 'time') {
      fetchAdvancedViz();
    }
  }, [activeTab, measurementId, fftData.length, cwtImage]);


  const handleProcess = async () => {
    setIsProcessing(true);
    try {
      await axios.post(`http://127.0.0.1:8000/measurements/${measurementId}/process`);
      await fetchDetail(); 
      if (onProcessed) onProcessed(); 
    } catch (error) {
      alert("Chyba při zpracování: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!measurementId) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content detail-modal-styled" style={{ maxWidth: '1300px', padding: 0, borderRadius: '8px', overflow: 'hidden' }}>
        
        {/* --- HLAVIČKA --- */}
        <div style={{ 
          background: 'linear-gradient(90deg, #cd3808 0%, #ff5e00 100%)', 
          padding: '15px 25px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Detail měření #{measurementId}</h2>
            <button 
              onClick={handleProcess}
              disabled={!!details || isProcessing}
              style={{
                background: details ? 'rgba(255,255,255,0.2)' : 'white',
                color: details ? '#eee' : '#cd3808',
                border: 'none',
                padding: '6px 16px',
                borderRadius: '4px',
                fontWeight: 'bold',
                cursor: details ? 'default' : 'pointer',
                fontSize: '0.9rem',
                display: 'flex', alignItems: 'center', gap: '8px'
              }}
            >
              {isProcessing ? '⚡ Počítám...' : details ? '✅ Zpracováno' : '⚙️ Spustit analýzu'}
            </button>
          </div>
          <button 
            onClick={onClose} 
            style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer' }}
          >
            &times;
          </button>
        </div>

        {/* --- OBSAH --- */}
        <div style={{ padding: '25px', background: '#f8fafc', minHeight: '500px' }}>
          {loading ? <p>Načítám data...</p> : (
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '25px' }}>
              
              {/* LEVÝ SLOUPEC: GRAFY A ZÁLOŽKY */}
              <div className="card-shadow" style={{ background: 'white', padding: '0', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                
                {/* ZÁLOŽKY */}
                <div className="viz-tabs">
                  <button className={`viz-tab ${activeTab === 'time' ? 'active' : ''}`} onClick={() => setActiveTab('time')}>
                    Časový průběh (1.28 s)
                  </button>
                  <button className={`viz-tab ${activeTab === 'fft' ? 'active' : ''}`} onClick={() => setActiveTab('fft')}>
                    Frekvenční spektrum (FFT)
                  </button>
                  <button className={`viz-tab ${activeTab === 'cwt' ? 'active' : ''}`} onClick={() => setActiveTab('cwt')}>
                    Časově-frekvenční (CWT)
                  </button>
                </div>

                {/* PLÁTNO GRAFU */}
                <div style={{ padding: '20px', width: '100%', height: '450px', position: 'relative' }}>
                  
                  {loadingViz ? (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                      Generuji {activeTab.toUpperCase()}...
                    </div>
                  ) : (
                    <>
                      {/* 1. ČASOVÝ PRŮBĚH */}
                      {activeTab === 'time' && (
                        <ResponsiveContainer>
                          <LineChart data={rawData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis 
                              dataKey="time" 
                              label={{ value: 'Čas [ms]', position: 'insideBottomRight', offset: -5 }} 
                              tick={{ fontSize: 12 }}
                            />
                            <YAxis 
                              label={{ value: 'Amplituda [g]', angle: -90, position: 'insideLeft' }} 
                              domain={['auto', 'auto']}
                              tick={{ fontSize: 12 }}
                            />
                            <Tooltip 
                              contentStyle={{ borderRadius: '4px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                              formatter={(value) => [value.toFixed(4) + ' g', 'Amplituda']}
                              labelFormatter={(label) => `Čas: ${label} ms`}
                            />
                            <ReferenceLine y={0} stroke="#cbd5e1" />
                            <Line 
                              type="monotone" 
                              dataKey="v" 
                              stroke="#cd3808" 
                              strokeWidth={1.5} 
                              dot={false} 
                              isAnimationActive={false} 
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      )}

                      {/* 2. FREKVENČNÍ SPEKTRUM (FFT) */}
                      {activeTab === 'fft' && (
                        <ResponsiveContainer>
                          <LineChart data={fftData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis 
                              dataKey="freq" 
                              label={{ value: 'Frekvence [Hz]', position: 'insideBottomRight', offset: -5 }} 
                              tickFormatter={(val) => val.toFixed(0)}
                              tick={{ fontSize: 12 }}
                            />
                            <YAxis 
                              label={{ value: 'Amplituda', angle: -90, position: 'insideLeft' }} 
                              tick={{ fontSize: 12 }}
                            />
                            <Tooltip 
                              contentStyle={{ borderRadius: '4px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                              formatter={(value) => [value.toFixed(4), 'Amplituda']}
                              labelFormatter={(label) => `Frekvence: ${Number(label).toFixed(1)} Hz`}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="amp" 
                              stroke="#0284c7" /* Modrá barva pro odlišení */
                              strokeWidth={1.5} 
                              dot={false} 
                              isAnimationActive={false} 
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      )}

                      {/* 3. CWT SKALOGRAM */}
                      {activeTab === 'cwt' && cwtImage && (
                        <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                          <img 
                            src={cwtImage} 
                            alt="CWT Scalogram" 
                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', border: '1px solid #e2e8f0', borderRadius: '4px' }} 
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* PRAVÝ SLOUPEC: HODNOTY (Nezměněno) */}
              <div className="card-shadow" style={{ background: 'white', padding: '0', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '15px 20px', borderBottom: '1px solid #e2e8f0', background: '#fff7ed' }}>
                  <h4 style={{ margin: 0, color: '#9a3412' }}>Vypočtené parametry</h4>
                </div>
                
                <div style={{ padding: '20px', flex: 1 }}>
                  {details ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      
                      <FeatureRow label="RMS (Efektivní h.)" value={details.rms_raw?.toFixed(4)} unit="g" highlight />
                      <FeatureRow label="Peak (Špička)" value={details.peak_raw?.toFixed(4)} unit="g" />
                      <FeatureRow label="Peak-to-Peak" value={(details.max_val - details.min_val)?.toFixed(4)} unit="g" />
                      
                      <div style={{ height: '1px', background: '#e2e8f0', margin: '5px 0' }}></div>
                      
                      <FeatureRow label="Max hodnota" value={details.max_val?.toFixed(3)} unit="g" small />
                      <FeatureRow label="Min hodnota" value={details.min_val?.toFixed(3)} unit="g" small />
                      
                      <div style={{ height: '1px', background: '#e2e8f0', margin: '5px 0' }}></div>
                      
                      <FeatureRow label="Kurtosis" value={details.kurtosis_raw?.toFixed(3)} unit="-" />
                      <FeatureRow label="Crest Factor" value={details.crest_factor?.toFixed(3)} unit="-" />

                      <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
                        <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Zdrojový soubor:</label>
                        <div style={{ 
                          background: '#f1f5f9', 
                          padding: '8px', 
                          borderRadius: '4px', 
                          fontSize: '0.7rem', 
                          color: '#475569', 
                          wordBreak: 'break-all',
                          fontFamily: 'monospace'
                        }}>
                          {details.raw_data_path}
                        </div>
                        <div style={{ marginTop: '5px', fontSize: '0.7rem', color: '#94a3b8' }}>
                          Analyzováno: {new Date(details.time || Date.now()).toLocaleString('cs-CZ')}
                        </div>
                      </div>

                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: '50px' }}>
                      <p>Data nebyla zpracována.</p>
                      <button 
                        onClick={handleProcess} 
                        className="btn-diagnose"
                        disabled={isProcessing}
                        style={{ marginTop: '10px', width: '100%' }}
                      >
                        {isProcessing ? 'Pracuji...' : 'Spustit výpočet'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Pomocná komponenta pro řádek v tabulce
const FeatureRow = ({ label, value, unit, highlight, small }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
    <span style={{ color: '#64748b', fontSize: small ? '0.85rem' : '0.95rem' }}>{label}</span>
    <span style={{ 
      fontWeight: highlight ? 'bold' : '500', 
      fontSize: highlight ? '1.2rem' : (small ? '0.9rem' : '1.1rem'), 
      color: highlight ? '#cd3808' : '#1e293b' 
    }}>
      {value} <span style={{ fontSize: '0.7em', color: '#94a3b8', fontWeight: 'normal' }}>{unit}</span>
    </span>
  </div>
);

export default MeasurementDetailModal;