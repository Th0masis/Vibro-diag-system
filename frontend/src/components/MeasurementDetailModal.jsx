import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine 
} from 'recharts';

function MeasurementDetailModal({ measurementId, onClose, onProcessed }) {
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState(null); // Features (pokud existují)
  const [rawData, setRawData] = useState([]);   // Graf
  const [isProcessing, setIsProcessing] = useState(false);
  const [meta, setMeta] = useState({});         // Cesta k souboru atd.

  // XJTU-SY sampling parameters
  const SAMPLING_FREQ = 25600; // 25.6 kHz
  const DOWNSAMPLE_STEP = 16;  // Musí odpovídat tomu, co posílá backend (step=16)

  const fetchDetail = async () => {
    try {
      setLoading(true);
      // Paralelní volání: Raw data + Features
      // Pokud features neexistují (404/null), musíme to ošetřit, aby nespadl celý Promise.all
      // Proto voláme features zvlášť nebo v try-catch bloku, pokud backend vrací null.
      
      const rawRes = await axios.get(`http://127.0.0.1:8000/measurements/${measurementId}/raw`);
      
      // Pokusíme se načíst features. Pokud neexistují, backend vrátí null nebo prázdný objekt
      let featResData = null;
      try {
        const featRes = await axios.get(`http://127.0.0.1:8000/measurements/${measurementId}/features`);
        featResData = featRes.data; // Může být null
      } catch (e) {
        console.log("Features zatím neexistují.");
      }

      // Přepočet indexů na čas (ms)
      const formattedRaw = rawRes.data.map((val, idx) => ({
        // t = (index * step / freq) * 1000 ms
        time: ((idx * DOWNSAMPLE_STEP) / SAMPLING_FREQ * 1000).toFixed(1), 
        v: val
      }));
      
      setRawData(formattedRaw);
      setDetails(featResData);
      
      // Pokud máme features, vezmeme cestu odtamtud, jinak si ji musíme vytáhnout z raw endpointu nebo historie
      // Pro zjednodušení předpokládám, že rawRes.data je jen pole. 
      // Pokud potřebujeme cestu i u nezpracovaných dat, museli bychom upravit backend endpoint /raw aby vracel objekt { data: [], path: "" }
      // Pro teď zobrazíme cestu jen když máme features, nebo ji pošleme přes props z parenta.
      
    } catch (error) {
      console.error("Chyba detailu:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (measurementId) fetchDetail();
  }, [measurementId]);

  const handleProcess = async () => {
    setIsProcessing(true);
    try {
      await axios.post(`http://127.0.0.1:8000/measurements/${measurementId}/process`);
      await fetchDetail(); // Obnovíme data v modalu (načtou se nové features)
      if (onProcessed) onProcessed(); // Řekneme rodiči (tabulce), ať se aktualizuje
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
        
        {/* --- HLAVIČKA (B&R Style) --- */}
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
            {/* Tlačítko pro zpracování přímo v hlavičce */}
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
              
              {/* LEVÝ SLOUPEC: GRAF */}
              <div className="card-shadow" style={{ background: 'white', padding: '20px', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 15px 0', color: '#475569' }}>Časový průběh vibrací (1.28 s snapshot)</h4>
                <div style={{ width: '100%', height: '450px' }}>
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
                      {/* Referenční čára nuly */}
                      <ReferenceLine y={0} stroke="#cbd5e1" />
                      <Line 
                        type="monotone" 
                        dataKey="v" 
                        stroke="#cd3808" 
                        strokeWidth={1.5} 
                        dot={false} 
                        isAnimationActive={false} // Vypnutí animace pro rychlost
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* PRAVÝ SLOUPEC: HODNOTY */}
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