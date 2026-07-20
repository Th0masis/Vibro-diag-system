import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useValidationState } from '../utils/validation';

const MachineSettings = ({ machineId }) => {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [testingOpc, setTestingOpc] = useState(false);
  const [testingFtp, setTestingFtp] = useState(false);
  
  // Stavy formulářů - odpovídají struktuře z backendu
  const [isActiveCollection, setIsActiveCollection] = useState(false); // NOVÝ STAV PRO TOGGLE
  const [opcUa, setOpcUa] = useState({ url: '' });
  const [ftp, setFtp] = useState({ 
    host: '', 
    username: '', 
    password: '', 
    directory: '' 
  });

  const settingsFormValues = {
    opc_url: opcUa.url,
    ftp_host: ftp.host,
    ftp_username: ftp.username,
    ftp_directory: ftp.directory,
  };

  const validateSettingsField = (field, value, values) => {
    const v = String(value || '').trim();
    if (field === 'opc_url') {
      if (!v) return 'OPC UA endpoint is required.';
      if (!/^opc\.tcp:\/\//i.test(v)) return 'OPC UA endpoint must start with opc.tcp://';
      return '';
    }
    if (field === 'ftp_host') {
      if (!v) return 'FTP host is required.';
      return '';
    }
    if (field === 'ftp_username') {
      if (!v) return 'FTP username is required.';
      return '';
    }
    if (field === 'ftp_directory') {
      if (!v) return 'FTP target folder is required.';
      return '';
    }
    return '';
  };

  const {
    touched,
    errors,
    onBlurField,
    onChangeField,
    validateForm,
    getInputClass,
  } = useValidationState(validateSettingsField);

  // 1. NAČTENÍ DAT PŘI OTEVŘENÍ
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setFetching(true);
        const response = await axios.get(`/machines/${machineId}/settings`);
        
        // Načtení nového flagu (pokud přijde null, nastaví se na false)
        setIsActiveCollection(response.data.is_active_collection || false); 
        setOpcUa(response.data.opc_ua);
        setFtp(response.data.ftp);
      } catch (error) {
        console.error("Chyba při načítání nastavení:", error);
        setMessage({ text: 'Could not load current settings from the database.', type: 'error' });
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

    const isValid = validateForm(['opc_url', 'ftp_host', 'ftp_username', 'ftp_directory'], settingsFormValues);
    if (!isValid) {
      setLoading(false);
      setMessage({ text: 'Please fix highlighted fields before saving configuration.', type: 'error' });
      return;
    }

    try {
      await axios.put(`/machines/${machineId}/settings`, {
        is_active_collection: isActiveCollection, // PŘIDÁNO DO PAYLOADU
        opc_ua: opcUa,
        ftp: ftp
      });
      setMessage({ text: 'Machine configuration saved successfully.', type: 'success' });
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Failed to save settings.';
      setMessage({ text: errorMsg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // 3. REÁLNÝ TEST PŘIPOJENÍ
  const handleTestConnection = async (type) => {
    const setTesting = type === 'opc' ? setTestingOpc : setTestingFtp;
    setTesting(true);
    setMessage({ text: '', type: '' });
    
    try {
      const payload = type === 'opc' ? opcUa : ftp;
      const response = await axios.post(`/machines/${machineId}/test-connection?type=${type}`, payload);
      setMessage({ text: response.data.message, type: 'success' });
    } catch (error) {
      if (error.response?.status === 401) {
        setMessage({ text: 'Your session has expired. Please sign in again.', type: 'error' });
        return;
      }
      const errorMsg = error.response?.data?.detail || `${type.toUpperCase()} connection failed.`;
      setMessage({ text: errorMsg, type: 'error' });
    } finally {
      setTesting(false);
    }
  };

  const getMessageStyles = (type) => {
    if (type === 'error') return { bg: '#fff1f2', color: 'var(--status-fault)', border: '1px solid #fecaca' };
    if (type === 'info') return { bg: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' };
    return { bg: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' };
  };

  if (fetching) return <div style={{ padding: '20px', color: 'var(--text-muted)' }}>Loading machine configuration…</div>;

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
        
        {/* NOVÁ SEKCE: Hlavní přepínač sběru dat */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          padding: '20px', 
          background: isActiveCollection ? '#f0fdf4' : '#f8fafc', 
          border: isActiveCollection ? '1px solid #bbf7d0' : '1px solid #e2e8f0', 
          borderRadius: '8px', 
          marginBottom: '25px',
          transition: 'all 0.3s ease'
        }}>
          <div>
            <div style={{ fontWeight: 'bold', color: isActiveCollection ? 'var(--status-ok)' : 'var(--text-muted)', fontSize: '1.1rem', marginBottom: '4px' }}>
            {isActiveCollection ? 'Automatic data collection is ACTIVE' : 'Automatic data collection is OFF'}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Determines whether the backend will periodically (every 4 h) pull RAW data and OPC UA values.
            </div>
          </div>
          
          {/* CSS Toggle Switch */}
          <label style={{ position: 'relative', display: 'inline-block', width: '54px', height: '28px', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={isActiveCollection} 
              onChange={(e) => setIsActiveCollection(e.target.checked)} 
              style={{ opacity: 0, width: 0, height: 0 }} 
            />
            <span style={{ 
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
              backgroundColor: isActiveCollection ? 'var(--primary)' : '#cbd5e1', 
              transition: '.3s', borderRadius: '34px' 
            }}>
              <span style={{ 
                position: 'absolute', content: '""', height: '20px', width: '20px', 
                left: isActiveCollection ? '30px' : '4px', bottom: '4px', 
                backgroundColor: 'white', transition: '.3s', borderRadius: '50%',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }}></span>
            </span>
          </label>
        </div>

        {/* Grid pro dvě sekce nastavení */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
          
          {/* OPC UA Sekce */}
          <div className="detail-card card-tech">
            <div className="card-title">OPC UA Communication</div>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '20px' }}>
              Connection parameters for live characteristic readout from the PLC.
            </p>

            <div className="add-user-modal" style={{ maxWidth: '100%', padding: 0, boxShadow: 'none' }}>
              <div className="form-group">
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#475569' }}>Server address (Endpoint URL)</label>
                <input 
                  type="text" 
                  value={opcUa.url} 
                  className={getInputClass('opc_url', opcUa.url)}
                  onChange={e => {
                    const value = e.target.value;
                    const nextValues = { ...settingsFormValues, opc_url: value };
                    setOpcUa({ url: value });
                    onChangeField('opc_url', value, nextValues);
                  }}
                  onBlur={() => onBlurField('opc_url', opcUa.url, settingsFormValues)}
                  aria-invalid={Boolean(touched.opc_url && errors.opc_url)}
                  placeholder="opc.tcp://10.24.137.37:4840"
                />
                <small className="form-helper-text error" aria-live="polite">{touched.opc_url ? (errors.opc_url || ' ') : ' '}</small>
              </div>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid #f1f5f9' }}>
              <button 
                type="button" 
                className="btn-test-conn btn-test-conn--opc"
                onClick={() => handleTestConnection('opc')}
                disabled={testingOpc}
              >
                {testingOpc
                  ? <><span className="loading-spinner" aria-hidden="true"></span>Testing…</>
                  : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.55a11 11 0 0114.08 0"/><path d="M1.42 9a16 16 0 0121.16 0"/><path d="M8.53 16.11a6 6 0 016.95 0"/><circle cx="12" cy="20" r="1"/></svg>Test OPC UA</>
                }
              </button>
            </div>
          </div>

          {/* FTP Sekce */}
          <div className="detail-card card-sensors">
            <div className="card-title">FTP Server (RAW Data)</div>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '20px' }}>
              Access for automatic download of raw measurements from the PLC file system.
            </p>

            <div className="add-user-modal" style={{ maxWidth: '100%', padding: 0, boxShadow: 'none' }}>
              <div className="form-group">
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#475569' }}>IP Address (Host)</label>
                <input 
                  type="text" 
                  value={ftp.host} 
                  className={getInputClass('ftp_host', ftp.host)}
                  onChange={e => {
                    const value = e.target.value;
                    const nextValues = { ...settingsFormValues, ftp_host: value };
                    setFtp({...ftp, host: value});
                    onChangeField('ftp_host', value, nextValues);
                  }}
                  onBlur={() => onBlurField('ftp_host', ftp.host, settingsFormValues)}
                  aria-invalid={Boolean(touched.ftp_host && errors.ftp_host)}
                  placeholder="10.24.137.37"
                />
                <small className="form-helper-text error" aria-live="polite">{touched.ftp_host ? (errors.ftp_host || ' ') : ' '}</small>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#475569' }}>Username</label>
                  <input 
                    type="text" 
                    value={ftp.username} 
                    className={getInputClass('ftp_username', ftp.username)}
                    onChange={e => {
                      const value = e.target.value;
                      const nextValues = { ...settingsFormValues, ftp_username: value };
                      setFtp({...ftp, username: value});
                      onChangeField('ftp_username', value, nextValues);
                    }}
                    onBlur={() => onBlurField('ftp_username', ftp.username, settingsFormValues)}
                    aria-invalid={Boolean(touched.ftp_username && errors.ftp_username)}
                  />
                  <small className="form-helper-text error" aria-live="polite">{touched.ftp_username ? (errors.ftp_username || ' ') : ' '}</small>
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#475569' }}>Password</label>
                  <input 
                    type="password" 
                    value={ftp.password} 
                    onChange={e => setFtp({...ftp, password: e.target.value})}
                    placeholder="••••••"
                  />
                </div>
              </div>

              <div className="form-group">
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#475569' }}>Target folder on PLC</label>
                <input 
                  type="text" 
                  value={ftp.directory} 
                  className={getInputClass('ftp_directory', ftp.directory)}
                  onChange={e => {
                    const value = e.target.value;
                    const nextValues = { ...settingsFormValues, ftp_directory: value };
                    setFtp({...ftp, directory: value});
                    onChangeField('ftp_directory', value, nextValues);
                  }}
                  onBlur={() => onBlurField('ftp_directory', ftp.directory, settingsFormValues)}
                  aria-invalid={Boolean(touched.ftp_directory && errors.ftp_directory)}
                  style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
                />
                <small className="form-helper-text error" aria-live="polite">{touched.ftp_directory ? (errors.ftp_directory || ' ') : ' '}</small>
              </div>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid #f1f5f9' }}>
              <button 
                type="button" 
                className="btn-test-conn btn-test-conn--ftp"
                onClick={() => handleTestConnection('ftp')}
                disabled={testingFtp}
              >
                {testingFtp
                  ? <><span className="loading-spinner" aria-hidden="true"></span>Testing…</>
                  : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>Test FTP</>
                }
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
              background: 'var(--primary)'
            }}
          >
            {loading ? 'Saving…' : 'Save configuration'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default MachineSettings;