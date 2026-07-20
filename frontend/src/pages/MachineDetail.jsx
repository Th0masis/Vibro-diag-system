import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

import ServiceNotes from '../components/ServiceNotes';
import MeasurementsHistory from '../components/MeasurementsHistory';
import MachineGraphs from '../components/MachineGraphs';
import MachineSensors from '../components/MachineSensors';
import MachineDiagnostics from '../components/MachineDiagnostics';
import MachineSettings from '../components/MachineSettings';
import PageTitle from '../components/PageTitle';

/* ── inline tab icons ── */
const TabIcons = {
  graphs:      (<svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="18" y="3" width="4" height="18"/><rect x="10" y="8" width="4" height="13"/><rect x="2" y="13" width="4" height="8"/></svg>),
  diagnostics: (<svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>),
  notes:       (<svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>),
  history:     (<svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>),
  sensors:     (<svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>),
  settings:    (<svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>),
};

const TAB_ORDER = [
  { key: 'graphs', label: 'Charts' },
  { key: 'diagnostics', label: 'AI Analysis', priority: true },
  { key: 'notes', label: 'Maintenance Log' },
  { key: 'history', label: 'History' },
  { key: 'sensors', label: 'Sensors' },
  { key: 'settings', label: 'Settings' },
];

/* Mobile (≤639px) shows only the most-used tabs directly; the rest live behind
   a "More" bottom sheet instead of reusing the shrunk-down desktop tab bar. */
const MOBILE_PRIMARY_KEYS = ['graphs', 'diagnostics', 'history', 'sensors'];


function MachineDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(location.state?.tab || 'sensors');
  const [preselectedSensorId, setPreselectedSensorId] = useState(null);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreButtonRef = useRef(null);
  const tabSheetRef = useRef(null);

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

  const handleTabKeyDown = (event) => {
    const currentIndex = TAB_ORDER.findIndex((t) => t.key === activeTab);
    let nextIndex = null;

    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % TAB_ORDER.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + TAB_ORDER.length) % TAB_ORDER.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = TAB_ORDER.length - 1;
    else return;

    event.preventDefault();
    const nextTab = TAB_ORDER[nextIndex].key;
    setActiveTab(nextTab);
    requestAnimationFrame(() => {
      document.getElementById(`tab-btn-${nextTab}`)?.focus();
    });
  };

  const closeMoreMenu = () => {
    setMoreMenuOpen(false);
    requestAnimationFrame(() => {
      moreButtonRef.current?.focus();
    });
  };

  useEffect(() => {
    if (!moreMenuOpen) return undefined;

    const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const getFocusable = () => Array.from(tabSheetRef.current?.querySelectorAll(focusableSelector) || []);

    requestAnimationFrame(() => {
      getFocusable()[0]?.focus();
    });

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMoreMenu();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [moreMenuOpen]);

  const secondaryTabs = TAB_ORDER.filter((t) => !MOBILE_PRIMARY_KEYS.includes(t.key));
  const isSecondaryTabActive = secondaryTabs.some((t) => t.key === activeTab);

  if (loading || !data) return <div className="page-container"><div className="loading-message"><span className="loading-spinner" aria-hidden="true"></span><span>Loading machine…</span></div></div>;

  const { info, sensors, last_note } = data;
  const noteSeverityClass = last_note
    ? `machine-note-severity-${(last_note.severity || 'INFO').toLowerCase()}`
    : 'machine-note-severity-none';

return (
    <div className="page-container">
      
      {/* 1. HLAVIČKA - PŘESKLÁDANÁ */}
      <PageTitle 
        title={
          <>
            {info.name}
            <span className={`role-badge ${info.status} machine-detail-status-badge`}>
               {info.status}
            </span>
          </>
        }
        subtitle={
          <>
            <span className="machine-meta-type">{info.type}</span>
            <span className="machine-meta-divider">·</span>
            <span className="machine-meta-location">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{display:'inline',verticalAlign:'middle',marginRight:'3px',marginBottom:'1px'}}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
              {info.location}
            </span>
          </>
        }
      >
        <button onClick={() => navigate('/machines')} className="btn-back">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          Back
        </button>
      </PageTitle>

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
              <label>Device description</label>
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
                  {new Date(last_note.timestamp).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
        <div className="tabs-header" role="tablist" aria-label="Machine detail sections" onKeyDown={handleTabKeyDown}>
          {TAB_ORDER.map(({ key, label, priority }) => (
            <button
              key={key}
              id={`tab-btn-${key}`}
              role="tab"
              type="button"
              aria-selected={activeTab === key}
              aria-controls={`tab-panel-${key}`}
              tabIndex={activeTab === key ? 0 : -1}
              className={`tab-btn ${MOBILE_PRIMARY_KEYS.includes(key) ? '' : 'tab-btn--secondary '}${priority ? 'tab-btn--priority ' : ''}${activeTab === key ? 'active' : ''}`}
              onClick={() => setActiveTab(key)}
            >
              {TabIcons[key]} {label}
            </button>
          ))}
          <button
            type="button"
            ref={moreButtonRef}
            className={`tab-btn tab-btn--more ${isSecondaryTabActive ? 'active' : ''}`}
            aria-haspopup="dialog"
            aria-expanded={moreMenuOpen}
            aria-controls="machine-detail-more-sheet"
            onClick={() => setMoreMenuOpen(true)}
          >
            <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
            More
          </button>
        </div>

        {moreMenuOpen && (
          <div className="tab-sheet-backdrop" onClick={closeMoreMenu}>
            <div
              id="machine-detail-more-sheet"
              ref={tabSheetRef}
              className="tab-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="machine-detail-more-sheet-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="tab-sheet-handle" aria-hidden="true" />
              <h2 id="machine-detail-more-sheet-title" className="sr-only">More sections</h2>
              {secondaryTabs.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  className={`tab-sheet-item ${activeTab === key ? 'active' : ''}`}
                  aria-current={activeTab === key ? 'true' : undefined}
                  onClick={() => {
                    setActiveTab(key);
                    closeMoreMenu();
                  }}
                >
                  {TabIcons[key]} {label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div
          className="tab-content"
          role="tabpanel"
          id={`tab-panel-${activeTab}`}
          aria-labelledby={`tab-btn-${activeTab}`}
          key={activeTab}
        >
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