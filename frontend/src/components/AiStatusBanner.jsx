import { useState, useEffect } from 'react';
import axios from 'axios';

function AiStatusBanner({ machineId }) {
  const [aiData, setAiData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAiData = async () => {
      try {
        const token = sessionStorage.getItem('token') || localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        
        const res = await axios.get(`/machines/${machineId}/latest-ai`, { headers });
        setAiData(res.data);
      } catch (err) {
        console.error("Chyba při načítání AI dat pro stroj", machineId);
      } finally {
        setLoading(false);
      }
    };

    fetchAiData();
  }, [machineId]);

  if (loading) {
    return (
      <div style={{ background: '#f8fafc', padding: '10px 15px', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '15px', animation: 'pulse 1.5s infinite' }}>
        Načítám AI diagnostiku...
      </div>
    );
  }

  // Zkontrolujeme, jestli máme data alespoň z jedné analýzy
  const hasData = aiData && (
    (aiData.anomaly?.timestamp) || 
    (aiData.fault?.timestamp) || 
    (aiData.rul?.timestamp)
  );

  if (!hasData) {
    return (
      <div style={{ background: '#f8fafc', padding: '10px 15px', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '15px', border: '1px dashed #cbd5e1' }}>
        <i>🧠 AI diagnostika zatím neproběhla.</i>
      </div>
    );
  }

  // Zjistíme nejnovější datum z dostupných analýz
  const timestamps = [
    aiData.anomaly?.timestamp, 
    aiData.fault?.timestamp, 
    aiData.rul?.timestamp
  ].filter(Boolean);
  const latestDate = timestamps.sort().reverse()[0];

  // LOGIKA BAREV
  const isAnomalyDetected = aiData.anomaly?.label === "Zjištěna anomálie";
  const isFaultClassified = aiData.fault?.label && !aiData.fault.label.toLowerCase().includes("zdrav");
  const isError = isAnomalyDetected || isFaultClassified;

  return (
    <div style={{ 
      background: isError ? '#fff5f5' : '#f0fdf4', 
      border: `1px solid ${isError ? '#fecaca' : '#bbf7d0'}`,
      padding: '12px 15px', 
      borderRadius: '8px', 
      marginTop: '15px',
      marginBottom: '15px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <strong style={{ fontSize: '0.85rem', color: isError ? 'var(--vut-red)' : '#16a34a', display: 'flex', alignItems: 'center', gap: '6px' }}>
          🧠 Výsledek AI Analýzy
        </strong>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{latestDate}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem', color: 'var(--text-main)' }}>
        
        {/* Detekce Anomálií (AE_ANOWGAN) */}
        {aiData.anomaly?.timestamp && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)' }}>Anomálie:</span>
            <span style={{ fontWeight: 'bold', color: isAnomalyDetected ? 'var(--vut-red)' : '#16a34a' }}>
              {isAnomalyDetected ? 'Zjištěna anomálie' : 'V normě'} 
              <span style={{ fontWeight: 'normal', fontSize: '0.75rem', opacity: 0.7, marginLeft: '5px' }}>
                (Skóre: {aiData.anomaly.value?.toFixed(2)})
              </span>
            </span>
          </div>
        )}

        {/* Klasifikace poruchy (1D_CNN) */}
        {aiData.fault?.timestamp && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', marginRight: '10px' }}>Detekce vady:</span>
            <span style={{ fontWeight: 'bold', textAlign: 'right', color: isFaultClassified ? 'var(--vut-red)' : '#16a34a' }}>
              {aiData.fault.label} 
              <span style={{ fontWeight: 'normal', fontSize: '0.75rem', opacity: 0.7, marginLeft: '5px' }}>
                ({(aiData.fault.confidence * 100).toFixed(1)} %)
              </span>
            </span>
          </div>
        )}

        {/* RUL - Životnost (Bi-LSTM) - VŽDY ZOBRAZENO */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginTop: '4px', 
          paddingTop: '6px', 
          borderTop: `1px solid ${isError ? '#fecaca' : '#bbf7d0'}` 
        }}>
          <span style={{ color: 'var(--text-muted)' }}>Odhadovaná RUL:</span>
          {aiData.rul?.timestamp ? (
            <span style={{ fontWeight: 'bold', color: 'var(--blue-primary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
              ⏳ {aiData.rul.value} dní
            </span>
          ) : (
            <span style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Nebylo spuštěno
            </span>
          )}
        </div>

      </div>
    </div>
  );
}

export default AiStatusBanner;