import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

import ServiceNotes from '../components/ServiceNotes';
import MeasurementsHistory from '../components/MeasurementsHistory';
import MachineGraphs from '../components/MachineGraphs';
import MachineSensors from '../components/MachineSensors';
import MachineDiagnostics from '../components/MachineDiagnostics';
import MachineSettings from '../components/MachineSettings';

/* ── inline tab icons ── */
const TabIcons = {
  graphs:      (<svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="18" y="3" width="4" height="18"/><rect x="10" y="8" width="4" height="13"/><rect x="2" y="13" width="4" height="8"/></svg>),
  diagnostics: (<svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>),
  notes:       (<svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>),
  history:     (<svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>),
  sensors:     (<svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>),
  settings:    (<svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>),
};

function MachineDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(location.state?.tab || 'sensors');
  const [preselectedSensorId, setPreselectedSensorId] = useState(null);

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

  useEffect(() => {
    fetchDetail();
  }, [id]);
   
  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab);
    }
  }, [location.state]);

  if (loading || !data) return <div className="page-container"><div className="loading-message"><span className="loading-spinner" aria-hidden="true"></span><span>Loading machine…</span></div></div>;

  const { info, sensors, last_note } = data;
  const noteSeverityClass = last_note
    ? `machine-note-severity-${(last_note.severity || 'INFO').toLowerCase()}`
    : 'machine-note-severity-none';

return (
    <div className="page-container">
      
      {/* 1. HLAVIČKA - PŘESKLÁDANÁ */}
      <div className="machine-header-container">
        {/* Left: Name, Status, Meta */}
        <div className="machine-title-section">
          <h1>
            {info.name}
            <span className={`role-badge ${info.status} machine-detail-status-badge`}>
               {info.status}
            </span>
          </h1>
          <div className="machine-meta">
            <span className="machine-meta-type">{info.type}</span>
            <span className="machine-meta-divider">·</span>
            <span className="machine-meta-location">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{display:'inline',verticalAlign:'middle',marginRight:'3px',marginBottom:'1px'}}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
              {info.location}
            </span>
          </div>
        </div>

        {/* Right: Back button */}
        <div>
          <button onClick={() => navigate('/machines')} className="btn-back">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            Back
          </button>
        </div>
      </div>

      {/* 2. HORNÍ GRID */}
      <div className="dashboard-grid-3">
        
        {/* BOX 1: Technické údaje */}
        <div className="detail-card card-tech">
          <div className="card-title card-title--primary">Technical info</div>
          <div className="detail-grid detail-grid--compact">
            <div className="detail-item"><label>Machine ID</label><p className="detail-value-strong">#{info.id_machine}</p></div>
            <div className="detail-item"><label>Installed</label><p>{info.installation_date}</p></div>
            <div className="detail-item"><label>Sensors (active)</label><p className="detail-value-strong">{sensors.filter((s) => s.status === 'active').length}</p></div>
            <div className="detail-item"><label>Sensors (available)</label><p>{sensors.filter((s) => s.status === 'available').length}</p></div>
            <div className="detail-item"><label>Sensors (maintenance)</label><p>{sensors.filter((s) => s.status === 'maintenance').length}</p></div>
            <div className="detail-item"><label>Total sensors</label><p>{sensors.length}</p></div>
            <div className="detail-item detail-item--full">
                <label>Popis zařízení</label>
                <p className="detail-description-text">{info.description}</p>
            </div>
          </div>
        </div>

        {/* BOX 2: Nejnovější poznámka */}
        <div className={`detail-card card-note ${noteSeverityClass}`}>
          <div className="card-title machine-note-title">
            Latest note
          </div>
          
          {last_note ? (
            <div className="machine-note-content-wrap">
              <div>
                <div className="machine-note-content">
                  "{last_note.content}"
                </div>
              </div>
              <div className="machine-note-meta">
                <span className="machine-note-author">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{display:'inline',verticalAlign:'middle',marginRight:'3px'}}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  {last_note.author}
                </span>
                <span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{display:'inline',verticalAlign:'middle',marginRight:'3px'}}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  {new Date(last_note.timestamp).toLocaleString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ) : (
            <div className="machine-note-empty-state">
              <svg className="machine-note-empty-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              <span>No notes yet</span>
            </div>
          )}
        </div>

      </div>

      {/* 3. TABS (Záložky) */}
      <div className="tabs-container">
        <div className="tabs-header">
          <button className={`tab-btn ${activeTab === 'graphs' ? 'active' : ''}`} onClick={() => setActiveTab('graphs')}>{TabIcons.graphs} Charts</button>
          <button className={`tab-btn tab-btn--priority ${activeTab === 'diagnostics' ? 'active' : ''}`} onClick={() => setActiveTab('diagnostics')}>{TabIcons.diagnostics} AI Analysis</button>
          <button className={`tab-btn ${activeTab === 'notes' ? 'active' : ''}`} onClick={() => setActiveTab('notes')}>{TabIcons.notes} Maintenance Log</button>
          <button className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>{TabIcons.history} History</button>
          <button className={`tab-btn ${activeTab === 'sensors' ? 'active' : ''}`} onClick={() => setActiveTab('sensors')}>{TabIcons.sensors} Sensors</button>
          <button className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>{TabIcons.settings} Settings</button>
        </div>

        <div className="tab-content">
          {activeTab === 'graphs' && (<MachineGraphs machineId={info.id_machine} />)}
          {activeTab === 'diagnostics' && (<MachineDiagnostics machineId={info.id_machine} onDiagnosisComplete={fetchDetail} />)}
          {activeTab === 'notes' && (<ServiceNotes machineId={info.id_machine} onNoteAdded={() => fetchDetail()}/>)}
          {activeTab === 'history' && (
            <MeasurementsHistory
              machineId={info.id_machine}
              initialSelectedMeasurementId={location.state?.selectedMeasurementId || null}
            />
          )}
          {activeTab === 'sensors' && (
            <MachineSensors 
                sensors={sensors}             
                machineId={info.id_machine}   
                onRefresh={fetchDetail}
                preselectedSensorId={preselectedSensorId}
                onPreselectedSensorHandled={() => setPreselectedSensorId(null)}
            />
          )}
          {/* 3. PŘIDÁNO VYKRESLENÍ NOVÉ KOMPONENTY */}
          {activeTab === 'settings' && (<MachineSettings machineId={info.id_machine} />)}
        </div>
      </div>

    </div>
  );
}

export default MachineDetail;