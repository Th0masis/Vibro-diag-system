import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

function MachineDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Stavy pro přiřazování senzoru
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [availableSensors, setAvailableSensors] = useState([]);
  const [assignForm, setAssignForm] = useState({ sensor_id: '', position: '' });

  // Načtení detailu stroje
  const fetchDetail = async () => {
    try {
      const response = await axios.get(`http://127.0.0.1:8000/machines/${id}`);
      setData(response.data);
    } catch (error) {
      console.error("Chyba při načítání detailu:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  // Načtení volných senzorů (volá se až po otevření modálu)
  const openAssignModal = async () => {
    try {
      const res = await axios.get('http://127.0.0.1:8000/sensors/available');
      setAvailableSensors(res.data);
      setAssignForm({ sensor_id: '', position: '' }); // Reset formuláře
      setIsAssignModalOpen(true);
    } catch (error) {
      alert("Nepodařilo se načíst seznam volných senzorů.");
    }
  };

  // Odeslání formuláře (Přiřazení)
  const handleAttachSensor = async (e) => {
    e.preventDefault();
    if (!assignForm.sensor_id) return alert("Vyberte senzor ze seznamu.");

    try {
      await axios.post(`http://127.0.0.1:8000/machines/${id}/sensors`, {
        sensor_id: assignForm.sensor_id,
        position: assignForm.position
      });
      
      setIsAssignModalOpen(false);
      fetchDetail(); // Refresh stránky, aby se nový senzor objevil v tabulce
    } catch (error) {
      alert("Chyba při přiřazování: " + error.response?.data?.detail);
    }
  };

  if (loading) return <div className="page-container"><p>Načítám data stroje...</p></div>;
  if (!data) return <div className="page-container"><p>Stroj nenalezen.</p></div>;

  const { info, sensors } = data;

  return (
    <div className="page-container">
      {/* HLAVIČKA */}
      <div style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <button onClick={() => navigate('/machines')} className="btn-cancel" style={{ marginBottom: '10px' }}>
            ← Zpět na seznam
          </button>
          <h1 style={{ margin: 0, color: 'var(--text)' }}>{info.name}</h1>
          <p style={{ color: '#64748b', margin: '5px 0 0 0' }}>{info.type} • {info.location}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
           <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '5px' }}>Aktuální kondice</div>
           <span className={`role-badge ${info.status}`} style={{ fontSize: '1.2rem', padding: '10px 20px' }}>
             {info.status}
           </span>
        </div>
      </div>

      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
        
        {/* INFO KARTA */}
        <div className="card" style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginTop: 0, color: 'var(--br-orange)', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px' }}>
            Technické údaje
          </h3>
          <div className="detail-grid">
            <div className="detail-item"><label>ID Stroje</label><p>{info.id_machine}</p></div>
            <div className="detail-item"><label>Instalace</label><p>{info.installation_date ? new Date(info.installation_date).toLocaleDateString('cs-CZ') : '-'}</p></div>
            <div className="detail-item" style={{ gridColumn: 'span 2' }}>
                <label>Popis</label>
                <p style={{ lineHeight: '1.5' }}>{info.description}</p>
            </div>
          </div>
        </div>

        {/* SENZORY KARTA */}
        <div className="card" style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
             <h3 style={{ margin: 0, color: 'var(--text)' }}>Osazené senzory</h3>
             <button className="btn-diagnose" onClick={openAssignModal} style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
               + Přiřadit senzor
             </button>
          </div>
          
          {sensors.length === 0 ? (
            <p style={{ color: '#94a3b8', fontStyle: 'italic', padding: '20px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px' }}>
              Zatím žádné senzory. Klikněte na tlačítko výše pro montáž.
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left', fontSize: '0.85rem', color: '#64748b' }}>
                  <th style={{ padding: '10px' }}>Pozice</th>
                  <th style={{ padding: '10px' }}>Senzor (S/N)</th>
                  <th style={{ padding: '10px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {sensors.map(s => (
                  <tr key={s.id_sensor} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 10px', fontWeight: 'bold' }}>{s.position || 'Neurčeno'}</td>
                    <td style={{ padding: '12px 10px' }}>
                        <div>{s.description}</div>
                        <small style={{ color: '#94a3b8' }}>{s.serial_number}</small>
                    </td>
                    <td style={{ padding: '12px 10px' }}>
                        <span className={`role-badge ${s.status}`} style={{ fontSize: '0.75rem' }}>{s.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MODÁL PRO PŘIŘAZENÍ SENZORU */}
      {isAssignModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content add-user-modal">
            <h2 style={{ color: 'var(--br-orange)', marginBottom: '20px' }}>Montáž senzoru</h2>
            <form onSubmit={handleAttachSensor}>
              
              <div className="form-group">
                <label>Vyberte senzor (pouze 'Available')</label>
                <select 
                  value={assignForm.sensor_id}
                  onChange={(e) => setAssignForm({...assignForm, sensor_id: e.target.value})}
                  required
                  style={{ padding: '10px', width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                >
                  <option value="" disabled>-- Vyberte senzor ze skladu --</option>
                  {availableSensors.map(s => (
                    <option key={s.id_sensor} value={s.id_sensor}>
                      {s.serial_number} - {s.description}
                    </option>
                  ))}
                </select>
                {availableSensors.length === 0 && (
                  <small style={{ color: 'var(--vut-red)', display: 'block', marginTop: '5px' }}>
                    Žádné volné senzory ve skladu. Nejdříve je musíte registrovat nebo uvolnit z jiného stroje.
                  </small>
                )}
              </div>

              <div className="form-group">
                <label>Umístění na stroji (Pozice)</label>
                <input 
                  type="text" 
                  placeholder="např. Ložisko motoru - Strana ventilátoru"
                  value={assignForm.position}
                  onChange={(e) => setAssignForm({...assignForm, position: e.target.value})}
                  required
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setIsAssignModalOpen(false)}>Zrušit</button>
                <button type="submit" className="btn-add-confirm" disabled={availableSensors.length === 0}>
                  Namontovat senzor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PLACEHOLDER GRAFY */}
      <div style={{ marginTop: '20px', padding: '40px', border: '2px dashed #cbd5e1', borderRadius: '12px', textAlign: 'center', color: '#64748b' }}>
          Zde budou grafy vibrační analýzy a historie měření
      </div>
    </div>
  );
}

export default MachineDetail;