import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function Dashboard() {
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMachines = async () => {
      try {
        // Využijeme tvůj existující endpoint /machines
        const res = await axios.get('http://127.0.0.1:8000/machines');
        setMachines(res.data);
      } catch (err) {
        console.error("Chyba při načítání dashboardu", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMachines();
  }, []);

  // Pomocná funkce pro navigaci na konkrétní záložku
  const goToDetail = (id, tabName) => {
    navigate(`/machines/${id}`, { state: { tab: tabName } });
  };

  if (loading) return <div className="page-container">Načítám dashboard...</div>;

  return (
    <div className="page-container">
      <h2 style={{ marginBottom: '25px', color: 'var(--text-main)' }}>Provozní Dashboard</h2>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', 
        gap: '25px' 
      }}>
        {machines.map(m => (
          <div key={m.id_machine} className="detail-card" style={{ borderTop: `5px solid ${m.status === 'OK' ? '#22c55e' : m.status === 'WARNING' ? 'var(--br-orange)' : 'var(--vut-red)'}` }}>
            
            {/* HLAVIČKA KARTY */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.4rem' }}>{m.name}</h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{m.type} | {m.location}</span>
              </div>
              <span className={`role-badge ${m.status}`} style={{ padding: '5px 12px' }}>{m.status}</span>
            </div>
            {/* VYLEPŠENÁ SEKCE POSLEDNÍ POZNÁMKA */}
            <div style={{ 
              margin: '15px 0', 
              padding: '12px', 
              background: m.last_note ? (
                  m.last_note_severity === 'CRITICAL' ? '#fff1f2' : 
                  m.last_note_severity === 'WARNING' ? '#fffbeb' : '#eff6ff'
              ) : '#f8fafc', 
              borderRadius: '8px', 
              borderLeft: `4px solid ${
                m.last_note ? (
                  m.last_note_severity === 'CRITICAL' ? 'var(--vut-red)' : 
                  m.last_note_severity === 'WARNING' ? 'var(--br-orange)' : '#3b82f6'
                ) : '#cbd5e1'
              }`,
              minHeight: '90px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              {/* Text poznámky */}
              <p style={{ 
                margin: '0 0 10px 0', 
                fontSize: '0.85rem', 
                color: m.last_note ? (
                  m.last_note_severity === 'CRITICAL' ? '#991b1b' : 
                  m.last_note_severity === 'WARNING' ? '#92400e' : '#1e40af'
                ) : '#94a3b8',
                fontStyle: m.last_note ? 'normal' : 'italic',
                lineHeight: '1.4',
                display: '-webkit-box',
                WebkitLineClamp: '3',
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}>
                {m.last_note ? `"${m.last_note}"` : "Zatím bez servisních záznamů"}
              </p>

              {/* Meta info: Autor a Čas (pouze pokud poznámka existuje) */}
              {m.last_note && (
                <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    fontSize: '0.7rem', 
                    fontWeight: '600',
                    opacity: 0.8,
                    borderTop: '1px solid rgba(0,0,0,0.05)',
                    paddingTop: '6px'
                }}>
                    <span>👤 {m.last_note_author || 'Neznámý'}</span>
                    <span>🕒 {m.last_note_time ? new Date(m.last_note_time).toLocaleString('cs-CZ', { 
                        day: '2-digit', 
                        month: '2-digit', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    }) : '-'}</span>
                </div>
            )}
            </div>
            {/* RYCHLÉ AKCE (TLAČÍTKA) */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: '10px',
              marginTop: 'auto' 
            }}>
              <button className="btn-back" onClick={() => goToDetail(m.id_machine, 'sensors')} style={{ fontSize: '0.85rem', justifyContent: 'center' }}>
                🔍 Detail
              </button>
              <button className="btn-back" onClick={() => goToDetail(m.id_machine, 'graphs')} style={{ fontSize: '0.85rem', justifyContent: 'center' }}>
                📈 Grafy
              </button>
              <button className="btn-back" onClick={() => goToDetail(m.id_machine, 'notes')} style={{ fontSize: '0.85rem', justifyContent: 'center' }}>
                📝 Poznámky
              </button>
              <button className="btn-diagnose" onClick={() => goToDetail(m.id_machine, 'diagnostics')} style={{ fontSize: '0.85rem', justifyContent: 'center' }}>
                🚀 AI Diagnostika
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;