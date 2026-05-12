import React, { useState, useEffect } from 'react';
import axios from 'axios';

const MachineSettings = ({ machineId }) => {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState({ text: '', type: '' });
  
  // Stavy formulářů - odpovídají struktuře z backendu
  const [opcUa, setOpcUa] = useState({ url: '' });
  const [ftp, setFtp] = useState({ 
    host: '', 
    username: '', 
    password: '', 
    directory: '' 
  });

  // 1. NAČTENÍ DAT PŘI OTEVŘENÍ
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setFetching(true);
        const response = await axios.get(`/machines/${machineId}/settings`);
        setOpcUa(response.data.opc_ua);
        setFtp(response.data.ftp);
      } catch (error) {
        console.error("Chyba při načítání nastavení:", error);
        setMessage({ text: 'Nepodařilo se načíst aktuální nastavení z databáze.', type: 'error' });
      } finally {
        setFetching(false);
      }
    };

    if (machineId) {
      fetchSettings();
    }
  }, [machineId]);

  // 2. ULOŽENÍ DAT DO DATABÁZE
  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      await axios.put(`/machines/${machineId}/settings`, {
        opc_ua: opcUa,
        ftp: ftp
      });
      setMessage({ text: 'Konfigurace stroje byla úspěšně uložena do databáze.', type: 'success' });
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Chyba při ukládání dat.';
      setMessage({ text: errorMsg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // 3. REÁLNÝ TEST PŘIPOJENÍ
  const handleTestConnection = async (type) => {
    setMessage({ text: `Testuji spojení s ${type.toUpperCase()} (čekejte cca 3s)...`, type: 'info' });
    
    try {
      // Podle toho, které tlačítko uživatel stiskl, pošleme příslušná data z React state
      const payload = type === 'opc' ? opcUa : ftp;
      
      const response = await axios.post(`/machines/${machineId}/test-connection?type=${type}`, payload);
      
      // Pokud to náhodou projde (když budeš na stejné síti)
      setMessage({ text: response.data.message, type: 'success' });
      
    } catch (error) {
      // Zde to zachytí ten Timeout Error z backendu a vypíše ti ho červeně
      const errorMsg = error.response?.data?.detail || `Spojení s ${type.toUpperCase()} selhalo.`;
      setMessage({ text: errorMsg, type: 'error' });
    }
  };

  const getMessageStyles = (type) => {
    if (type === 'error') return { bg: '#fff1f2', color: 'var(--vut-red)', border: '1px solid #fecaca' };
    if (type === 'info') return { bg: '#eff6ff', color: 'var(--blue-primary)', border: '1px solid #bfdbfe' };
    return { bg: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' };
  };

  if (fetching) return <div style={{ padding: '20px', color: 'var(--text-muted)' }}>Načítám konfiguraci stroje...</div>;

  return (
    <div>
      {/* Notifikační panel */}
      {message.text && (
        <div style={{
          padding: '12px 20px',
          marginBottom: '25px',
          borderRadius: '8px',
          fontWeight: '600',
          background: getMessageStyles(message.type).bg,
          color: getMessageStyles(message.type).color,
          border: getMessageStyles(message.type).border,
          boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
        }}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSave}>
        {/* Grid pro dvě sekce nastavení */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
          
          {/* OPC UA Sekce */}
          <div className="detail-card card-tech">
            <div className="card-title">OPC UA Komunikace</div>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '20px' }}>
              Parametry pro živé vyčítání charakteristik (RMS, Kurtosis, atd.) z PLC.
            </p>

            <div className="add-user-modal" style={{ maxWidth: '100%', padding: 0, boxShadow: 'none' }}>
              <div className="form-group">
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#475569' }}>Adresa serveru (Endpoint URL)</label>
                <input 
                  type="text" 
                  value={opcUa.url} 
                  onChange={e => setOpcUa({ url: e.target.value })}
                  placeholder="opc.tcp://10.24.137.37:4840"
                />
              </div>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid #f1f5f9' }}>
              <button 
                type="button" 
                className="btn-update" 
                onClick={() => handleTestConnection('opc')}
                style={{ width: '100%' }}
              >
                Testovat OPC UA
              </button>
            </div>
          </div>

          {/* FTP Sekce */}
          <div className="detail-card card-sensors">
            <div className="card-title">FTP Server (RAW Data)</div>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '20px' }}>
              Přístup pro automatické stahování hrubých měření ze souborového systému PLC.
            </p>

            <div className="add-user-modal" style={{ maxWidth: '100%', padding: 0, boxShadow: 'none' }}>
              <div className="form-group">
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#475569' }}>IP Adresa (Host)</label>
                <input 
                  type="text" 
                  value={ftp.host} 
                  onChange={e => setFtp({...ftp, host: e.target.value})}
                  placeholder="10.24.137.37"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#475569' }}>Uživatel</label>
                  <input 
                    type="text" 
                    value={ftp.username} 
                    onChange={e => setFtp({...ftp, username: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#475569' }}>Heslo</label>
                  <input 
                    type="password" 
                    value={ftp.password} 
                    onChange={e => setFtp({...ftp, password: e.target.value})}
                    placeholder="••••••"
                  />
                </div>
              </div>

              <div className="form-group">
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#475569' }}>Cílová složka na PLC</label>
                <input 
                  type="text" 
                  value={ftp.directory} 
                  onChange={e => setFtp({...ftp, directory: e.target.value})}
                  style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
                />
              </div>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid #f1f5f9' }}>
              <button 
                type="button" 
                className="btn-update" 
                onClick={() => handleTestConnection('ftp')}
                style={{ width: '100%', borderColor: 'var(--vut-red)', color: 'var(--vut-red)' }}
              >
                Testovat FTP
              </button>
            </div>
          </div>
        </div>

        {/* Hlavní akce */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '2px solid #e2e8f0', paddingTop: '20px' }}>
          <button 
            type="submit" 
            className="btn-add-confirm"
            disabled={loading}
            style={{ 
              padding: '12px 35px', 
              fontSize: '1rem',
              opacity: loading ? 0.6 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
              background: 'var(--br-orange)'
            }}
          >
            {loading ? 'Ukládám do DB...' : 'Uložit novou konfiguraci'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default MachineSettings;