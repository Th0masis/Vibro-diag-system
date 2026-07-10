import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine 
} from 'recharts';

function MeasurementDetailModal({ measurementId, onClose, onProcessed, inline = false }) {
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
  const SAMPLING_FREQ = 12800; 
  const DOWNSAMPLE_STEP = 16;  

  // Pomocná funkce pro získání autorizační hlavičky
  const getAuthHeader = () => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  };

  // 1. Načtení základu (Nejprve features, pokud jsou, tak i raw data)
  const fetchDetail = async () => {
    try {
      setLoading(true);
      
      let featResData = null;
      try {
        const featRes = await axios.get(`/measurements/${measurementId}/features`, getAuthHeader());
        featResData = featRes.data; 
        setDetails(featResData);
      } catch (e) {
        console.log("Měření zatím nemá vypočtené parametry.");
        setDetails(null);
      }

      // Pokud jsou data zpracována (mají rms_raw), načteme i surový signál pro graf
      if (featResData && featResData.rms_raw) {
        const rawRes = await axios.get(`/measurements/${measurementId}/raw`, getAuthHeader());
        const signalData = Array.isArray(rawRes.data) ? rawRes.data : (rawRes.data?.signal || []);
        
        if (signalData.length === 0) {
          setRawData([]);
        } else {
          const formattedRaw = signalData.map((val, idx) => ({
            time: ((idx * DOWNSAMPLE_STEP) / SAMPLING_FREQ * 1000).toFixed(1), 
            v: val
          }));
          setRawData(formattedRaw);
        }
      } else {
        setRawData([]); // Vyčistíme data, pokud není zpracováno
      }
      
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
        // Voláme pouze pokud jsou data už zpracovaná
        if (!details || !details.rms_raw) return;

        if (activeTab === 'fft' && fftData.length === 0) {
          const res = await axios.get(`/measurements/${measurementId}/fft`, getAuthHeader());
          const formattedFft = res.data.frequencies.map((freq, i) => ({
            freq: freq,
            amp: res.data.amplitudes[i]
          }));
          setFftData(formattedFft);
        } 
        else if (activeTab === 'cwt' && !cwtImage) {
          const res = await axios.get(`/measurements/${measurementId}/cwt`, getAuthHeader());
          setCwtImage(res.data.cwt_image);
        }
      } catch (err) {
        console.error(`Chyba načítání ${activeTab}:`, err);
      } finally {
        setLoadingViz(false);
      }
    };

    if (activeTab !== 'time') fetchAdvancedViz();
  }, [activeTab, measurementId, fftData.length, cwtImage, details]);

  // 3. Spuštění analýzy
  const handleProcess = async () => {
    setIsProcessing(true);
    try {
      await axios.post(`/measurements/${measurementId}/process`, {}, getAuthHeader());
      await fetchDetail(); 
      if (onProcessed) onProcessed(); 
    } catch (error) {
      alert('Processing failed: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const isProcessed = details && details.rms_raw;

  if (!measurementId) return null;

  const headerStyle = {
    background: '#ffffff',
    padding: '14px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #E2E8F0',
    color: '#111111'
  };

  const processButtonStyle = {
    background: isProcessed ? '#F1F5F9' : 'var(--primary, #F07800)',
    color: isProcessed ? '#94A3B8' : 'white',
    border: 'none',
    padding: '6px 14px',
    borderRadius: '6px',
    fontWeight: '600',
    cursor: isProcessed ? 'default' : 'pointer',
    fontSize: '0.85rem',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    minHeight: '32px'
  };

  const content = (
    <>
      {/* --- HLAVIČKA --- */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#111111' }}>Measurement #{measurementId}</h2>
          <button
            onClick={handleProcess}
            disabled={isProcessed || isProcessing}
            style={processButtonStyle}
          >
            {isProcessing ? (
              <><span style={{width:12,height:12,border:'2px solid rgba(255,255,255,0.4)',borderTopColor:'white',borderRadius:'50%',display:'inline-block',animation:'spin 0.8s linear infinite'}} aria-hidden="true"></span>Analysing…</>
            ) : isProcessed ? (
              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>Processed</>
            ) : (
              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>Run analysis</>
            )}
          </button>
        </div>
        <button
          onClick={onClose}
          className="modal-close-btn"
          title="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
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
                  Time signal (0.64 s)
                </button>
                <button className={`viz-tab ${activeTab === 'fft' ? 'active' : ''}`} onClick={() => setActiveTab('fft')}>
                  Frequency spectrum (FFT)
                </button>
                <button className={`viz-tab ${activeTab === 'cwt' ? 'active' : ''}`} onClick={() => setActiveTab('cwt')}>
                  Time-frequency (CWT)
                </button>
              </div>

              {/* PLÁTNO GRAFU */}
              <div style={{ padding: '20px', width: '100%', height: '450px', position: 'relative' }}>

                {!isProcessed ? (
                  <div style={{
                    height: '100%', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', color: '#94a3b8'
                  }}>
                    <span style={{ fontSize: '3rem', marginBottom: '10px' }}>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="12 3 20 7.5 20 16.5 12 21 4 16.5 4 7.5 12 3"/><polyline points="12 12.5 20 7.5"/><polyline points="12 12.5 12 21"/><polyline points="12 12.5 4 7.5"/></svg>
                    </span>
                    <p style={{ fontSize: '1rem', fontWeight: '500', color: '#374151' }}>Process data first</p>
                    <p style={{ fontSize: '0.85rem', marginTop: '5px', color: '#9CA3AF' }}>Use the ‘Run analysis’ button above.</p>
                  </div>
                  ) : loadingViz ? (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                    Loading {activeTab.toUpperCase()}…
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
                            label={{ value: 'Time [ms]', position: 'insideBottomRight', offset: -5 }}
                            tick={{ fontSize: 12 }}
                          />
                          <YAxis
                            label={{ value: 'Amplitude [g]', angle: -90, position: 'insideLeft' }}
                            domain={['auto', 'auto']}
                            tick={{ fontSize: 12 }}
                          />
                          <Tooltip
                            contentStyle={{ borderRadius: '4px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            formatter={(value) => [value.toFixed(4) + ' g', 'Amplitude']}
                            labelFormatter={(label) => `Time: ${label} ms`}
                          />
                          <ReferenceLine y={0} stroke="#cbd5e1" />
                          <Line
                            type="monotone"
                            dataKey="v"
                            stroke="#D96400"
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
                            label={{ value: 'Frequency [Hz]', position: 'insideBottomRight', offset: -5 }}
                            tickFormatter={(val) => val.toFixed(0)}
                            tick={{ fontSize: 12 }}
                          />
                          <YAxis
                            label={{ value: 'Amplitude', angle: -90, position: 'insideLeft' }}
                            tick={{ fontSize: 12 }}
                          />
                          <Tooltip
                            contentStyle={{ borderRadius: '4px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            formatter={(value) => [value.toFixed(4), 'Amplitude']}
                            labelFormatter={(label) => `Frequency: ${Number(label).toFixed(1)} Hz`}
                          />
                          <Line
                            type="monotone"
                            dataKey="amp"
                            stroke="#0284c7"
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

            {/* PRAVÝ SLOUPEC: HODNOTY */}
            <div className="card-shadow" style={{ background: 'white', padding: '0', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '12px 20px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                <h4 style={{ margin: 0, color: '#374151', fontWeight: 600, fontSize: '0.875rem' }}>Signal features</h4>
              </div>

              <div style={{ padding: '20px', flex: 1 }}>
                {isProcessed ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>

                    <FeatureRow label="RMS" value={details.rms_raw?.toFixed(4)} unit="g" highlight />
                    <FeatureRow label="Peak" value={details.peak_raw?.toFixed(4)} unit="g" />

                    <div style={{ height: '1px', background: '#e2e8f0', margin: '5px 0' }}></div>

                    <FeatureRow label="Skewness" value={details.skewness_raw?.toFixed(3)} unit="—" small />
                    <FeatureRow label="Kurtosis" value={details.kurtosis_raw?.toFixed(3)} unit="—" small />

                    <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
                      <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Source file:</label>
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
                        Analysed: {new Date(details.timestamp || details.time || Date.now()).toLocaleString('en-GB', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}
                      </div>
                    </div>

                  </div>
                ) : (
                  <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: '50px' }}>
                    <p>Not yet processed.</p>
                    <p style={{ fontSize: '0.8rem', marginTop: '10px' }}>Values appear after running analysis.</p>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </div>
    </>
  );

  if (inline) {
    return (
      <div className="card-shadow" style={{ background: 'white', borderRadius: '8px', overflow: 'hidden' }}>
        {content}
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content detail-modal-styled" style={{ maxWidth: '1300px', padding: 0, borderRadius: '8px', overflow: 'hidden' }}>
        {content}
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
      {value || '-'} <span style={{ fontSize: '0.7em', color: '#94a3b8', fontWeight: 'normal' }}>{unit}</span>
    </span>
  </div>
);

export default MeasurementDetailModal;