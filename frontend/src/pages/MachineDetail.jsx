import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

import ServiceNotes from '../components/ServiceNotes';
import MeasurementsHistory from '../components/MeasurementsHistory';
import MachineGraphs from '../components/MachineGraphs';
import MachineSensors from '../components/MachineSensors';
import MachineDiagnostics from '../components/MachineDiagnostics';
// 1. PŘIDÁN IMPORT NOVÉ KOMPONENTY PRO NASTAVENÍ
import MachineSettings from '../components/MachineSettings'; 

function MachineDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(location.state?.tab || 'sensors');

  // Stavy pro přiřazování senzoru
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [availableSensors, setAvailableSensors] = useState([]);
  const [assignForm, setAssignForm] = useState({ sensor_id: '', position: '' });

  const fetchDetail = async () => {
    try {
      const response = await axios.get(`/machines/${id}`);
      setData(response.data);
    } catch (error) {
      console.error("Chyba:", error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityStyles = (severity) => {
    switch (severity) {
      case 'CRITICAL': 
        return { border: 'var(--vut-red)', bg: '#fff1f2', text: '#991b1b', icon: '🔴' };
      case 'WARNING': 
        return { border: 'var(--br-orange)', bg: '#fffbeb', text: '#92400e', icon: '🟠' };
      case 'INFO': 
      default: 
        return { border: '#3b82f6', bg: '#eff6ff', text: '#1e40af', icon: '🔵' };
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);
   
  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab);
    }
  }, [location.state]);

  // Funkce pro rychlé odpojení senzoru
  const handleDetachSensor = async (sensorId) => {
    if(!window.confirm("Opravdu odebrat tento senzor ze stroje?")) return;
    try {
      // Zde také využíváme výhody globálního nastavení axios (smazáno http://127.0.0.1:8000)
      await axios.post(`/machines/${id}/sensors/${sensorId}/detach`);
      fetchDetail();
    } catch (error) {
      alert("Chyba při odpojování.");
    }
  };

  const openAssignModal = async () => {
    try {
      const res = await axios.get('/sensors/available');
      setAvailableSensors(res.data);
      setAssignForm({ sensor_id: '', position: '' });
      setIsAssignModalOpen(true);
    } catch (error) { alert("Chyba načítání senzorů"); }
  };

  const handleAttachSensor = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`/machines/${id}/sensors`, assignForm);
      setIsAssignModalOpen(false);
      fetchDetail();
    } catch (error) { alert("Chyba přiřazení"); }
  };

  if (loading || !data) return <div className="page-container">Načítám...</div>;

  const { info, sensors, last_note } = data;

return (
    <div className="page-container">
      
      {/* 1. HLAVIČKA - PŘESKLÁDANÁ */}
      <div className="machine-header-container">
        {/* Levá část: Název, Status, Info */}
        <div className="machine-title-section">
          <h1>
            {info.name}
            {/* Status Badge přímo vedle nadpisu */}
            <span className={`role-badge ${info.status}`} style={{ fontSize: '0.9rem', padding: '4px 12px', borderRadius: '20px', verticalAlign: 'middle', marginLeft: '10px' }}>
               {info.status}
            </span>
          </h1>
          <div className="machine-meta">
            <span style={{ color: 'var(--text-main)', fontWeight: 'bold' }}>{info.type}</span>
            <span style={{ margin: '0 10px' }}>•</span>
            <span>📍 {info.location}</span>
          </div>
        </div>

        {/* Pravá část: Tlačítko Zpět */}
        <div>
          <button onClick={() => navigate('/machines')} className="btn-back">
            <span>↩</span> Zpět na seznam
          </button>
        </div>
      </div>

      {/* 2. HORNÍ GRID (3 BOXY) */}
      <div className="dashboard-grid-3">
        
        {/* BOX 1: Technické údaje */}
        <div className="detail-card card-tech">
          <div className="card-title" style={{ color: 'var(--br-orange)' }}>Technické údaje</div>
          <div className="detail-grid" style={{ gap: '12px' }}>
            <div className="detail-item"><label>ID Stroje</label><p style={{fontWeight:'bold'}}>#{info.id_machine}</p></div>
            <div className="detail-item"><label>Instalace</label><p>{info.installation_date}</p></div>
            <div className="detail-item" style={{ gridColumn: 'span 2' }}>
                <label>Popis zařízení</label>
                <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: '1.5' }}>{info.description}</p>
            </div>
          </div>
        </div>

        {/* BOX 2: Senzory */}
        <div className="detail-card card-sensors">
          <div className="card-title">
             <span>Senzory ({sensors.length})</span>
             <button className="btn-diagnose" onClick={openAssignModal} style={{ fontSize: '0.75rem', padding: '5px 10px' }}>+ Přidat</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: '150px', paddingRight: '5px' }}>
            {sensors.length === 0 ? <p style={{ color: '#ccc', fontStyle: 'italic', fontSize: '0.9rem' }}>Bez senzorů</p> : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {sensors.map(s => (
                  <li key={s.id_sensor} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ lineHeight: '1.2' }}>
                      <div style={{ fontWeight: '600', fontSize: '0.9rem', color: '#334155' }}>{s.description}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'monospace' }}>S/N: {s.serial_number}</div>
                    </div>
                    <button 
                      className="btn-detach"
                      onClick={() => handleDetachSensor(s.id_sensor)}
                      title="Odpojit senzor"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* BOX 3: Nejnovější poznámka */}
        <div className="detail-card card-note" 
             style={{ 
               borderTopColor: last_note ? getSeverityStyles(last_note.severity).border : '#cbd5e1' 
             }}
        >
          <div className="card-title" style={{ color: last_note ? getSeverityStyles(last_note.severity).border : '#64748b' }}>
            Poslední záznam
          </div>
          
          {last_note ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
              <div>
                <div style={{ 
                    background: getSeverityStyles(last_note.severity).bg, 
                    borderLeft: `4px solid ${getSeverityStyles(last_note.severity).border}`, 
                    padding: '12px', 
                    fontSize: '0.9rem', 
                    fontStyle: 'italic',
                    color: getSeverityStyles(last_note.severity).text,
                    marginBottom: '10px',
                    borderRadius: '0 4px 4px 0',
                    maxHeight: '120px', 
                    overflowY: 'auto'
                }}>
                  "{last_note.content}"
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: '600', color: '#475569' }}>👤 {last_note.author}</span>
                <span>🕒 {new Date(last_note.timestamp).toLocaleString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#cbd5e1' }}>
              <span style={{ fontSize: '2rem', marginBottom: '10px' }}>📝</span>
              <span>Žádné poznámky</span>
            </div>
          )}
        </div>

      </div>

      {/* 3. TABS (Záložky) */}
      <div className="tabs-container">
        <div className="tabs-header">
          <button className={`tab-btn ${activeTab === 'graphs' ? 'active' : ''}`} onClick={() => setActiveTab('graphs')}>Grafy</button>
          <button className={`tab-btn ${activeTab === 'diagnostics' ? 'active' : ''}`} onClick={() => setActiveTab('diagnostics')}>Diagnostika (ML)</button>
          <button className={`tab-btn ${activeTab === 'notes' ? 'active' : ''}`} onClick={() => setActiveTab('notes')}>Deník údržby</button>
          <button className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>Historie měření</button>
          <button className={`tab-btn ${activeTab === 'sensors' ? 'active' : ''}`} onClick={() => setActiveTab('sensors')}>Senzory (Detail)</button>
          {/* 2. PŘIDÁNO TLAČÍTKO PRO NOVOU ZÁLOŽKU */}
          <button className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>Nastavení</button>
        </div>

        <div className="tab-content">
          {activeTab === 'graphs' && (<MachineGraphs machineId={info.id_machine} />)}
          {activeTab === 'diagnostics' && (<MachineDiagnostics machineId={info.id_machine} onDiagnosisComplete={fetchDetail} />)}
          {activeTab === 'notes' && (<ServiceNotes machineId={info.id_machine} onNoteAdded={() => fetchDetail()}/>)}
          {activeTab === 'history' && (<MeasurementsHistory machineId={info.id_machine} />)}
          {activeTab === 'sensors' && (
            <MachineSensors 
                sensors={sensors}             
                machineId={info.id_machine}   
                onRefresh={fetchDetail}       
            />
          )}
          {/* 3. PŘIDÁNO VYKRESLENÍ NOVÉ KOMPONENTY */}
          {activeTab === 'settings' && (<MachineSettings machineId={info.id_machine} />)}
        </div>
      </div>

      {/* MODÁL PRO PŘIŘAZENÍ SENZORU */}
       {isAssignModalOpen && (
        <div className="modal-overlay">
           <div className="modal-content add-user-modal">
            <h2 style={{ color: 'var(--br-orange)', marginBottom: '20px' }}>Montáž senzoru</h2>
            <form onSubmit={handleAttachSensor}>
              <div className="form-group">
                <label>Vyberte senzor</label>
                <select value={assignForm.sensor_id} onChange={(e) => setAssignForm({...assignForm, sensor_id: e.target.value})} required>
                  <option value="">-- Vybrat --</option>
                  {availableSensors.map(s => <option key={s.id_sensor} value={s.id_sensor}>{s.serial_number} - {s.description}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Pozice</label>
                <input type="text" value={assignForm.position} onChange={(e) => setAssignForm({...assignForm, position: e.target.value})} required />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setIsAssignModalOpen(false)}>Zrušit</button>
                <button type="submit" className="btn-add-confirm">Namontovat</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default MachineDetail;