import { useState, useEffect } from 'react';
import axios from 'axios';
import ConfirmModal from './ConfirmModal'; // 1. Import

function ServiceNotes({ machineId, onNoteAdded }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [severity, setSeverity] = useState("INFO");

  // 2. Stav pro modál mazání
  const [noteToDelete, setNoteToDelete] = useState(null); 

  const fetchNotes = async () => { /* ... stejné jako dřív ... */
    try {
        const res = await axios.get(`http://127.0.0.1:8000/machines/${machineId}/notes`);
        setNotes(res.data);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };
  useEffect(() => { fetchNotes(); }, [machineId]);

  const handleSubmit = async (e) => { /* ... stejné jako dřív ... */
    e.preventDefault();
    if (!newNote.trim()) return;
    try {
        await axios.post(`http://127.0.0.1:8000/machines/${machineId}/notes`, { content: newNote, severity });
        setNewNote(""); setSeverity("INFO"); fetchNotes(); 
        if (onNoteAdded) onNoteAdded();
    } catch (err) { alert("Chyba ukládání"); }
  };

  // 3. Tlačítko "X" jen nastaví ID a tím otevře modál
  const handleDeleteClick = (noteId) => {
    setNoteToDelete(noteId);
  };

  // 4. Skutečné smazání (volá se až z modálu)
  const performDelete = async () => {
    try {
      await axios.delete(`http://127.0.0.1:8000/machines/${machineId}/notes/${noteToDelete}`);
      fetchNotes();
      if (onNoteAdded) onNoteAdded();
    } catch (error) {
      alert("Chyba při mazání.");
    } finally {
      setNoteToDelete(null); // Zavřít modál
    }
  };

  const getSeverityStyle = (sev) => { /* ... stejné ... */ 
    switch (sev) {
        case 'CRITICAL': return { bg: '#fee2e2', color: '#991b1b', border: 'var(--vut-red)' };
        case 'WARNING': return { bg: '#fef9c3', color: '#854d0e', border: 'var(--br-orange)' };
        default: return { bg: '#eff6ff', color: '#1e40af', border: '#3b82f6' };
      }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '30px' }}>
      
      {/* ... Levá část formuláře beze změn ... */}
      <div>
         <h3 style={{ marginTop: 0, color: 'var(--text-main)' }}>Nový záznam</h3>
         <form onSubmit={handleSubmit} style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            {/* ... inputy formuláře (zkopíruj si z minula) ... */}
            <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: '#64748b' }}>Závažnost</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              {['INFO', 'WARNING', 'CRITICAL'].map(lev => (
                <button key={lev} type="button" onClick={() => setSeverity(lev)} style={{ flex: 1, padding: '8px', border: `1px solid ${severity === lev ? (lev==='INFO'?'#3b82f6':lev==='WARNING'?'var(--br-orange)':'var(--vut-red)') : '#cbd5e1'}`, background: severity === lev ? '#fff' : '#f1f5f9', color: severity === lev ? 'black' : '#64748b', borderRadius: '6px', cursor: 'pointer', fontWeight: severity===lev?'bold':'normal' }}>{lev}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: '15px' }}>
            <textarea rows="5" value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Zapište detaily..." style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', resize: 'vertical' }} required />
          </div>
          <button type="submit" className="btn-diagnose" style={{ width: '100%' }}>Uložit záznam</button>
         </form>
      </div>

      {/* Pravá část Historie */}
      <div>
        <h3 style={{ marginTop: 0, color: 'var(--text-main)' }}>Historie údržby</h3>
        {loading ? <p>Načítám...</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxHeight: '500px', overflowY: 'auto', paddingRight: '10px' }}>
            {notes.map(note => {
                const style = getSeverityStyle(note.severity);
                return (
                  <div key={note.id_note} style={{ display: 'flex', gap: '15px', padding: '15px', background: 'white', border: '1px solid #f1f5f9', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <div style={{ minWidth: '90px', textAlign: 'right', fontSize: '0.85rem', color: '#94a3b8' }}>
                      <div style={{ fontWeight: 'bold', color: '#64748b' }}>{new Date(note.timestamp).toLocaleDateString()}</div>
                      <div>{new Date(note.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                    </div>
                    <div style={{ flex: 1, borderLeft: `3px solid ${style.border}`, paddingLeft: '15px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'flex-start' }}>
                        <div>
                            <span style={{ fontWeight: 'bold', color: 'var(--text-main)', marginRight: '10px' }}>{note.author}</span>
                            <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px', background: style.bg, color: style.color, border: `1px solid ${style.border}` }}>{note.severity}</span>
                        </div>
                        <button 
                            onClick={() => handleDeleteClick(note.id_note)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', fontSize: '1.2rem', lineHeight: '0.5', padding: '0 5px' }}
                            title="Smazat záznam"
                            onMouseOver={(e) => e.target.style.color = 'var(--vut-red)'}
                            onMouseOut={(e) => e.target.style.color = '#cbd5e1'}
                        >
                            ×
                        </button>
                      </div>
                      <p style={{ margin: 0, color: '#334155', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{note.content}</p>
                    </div>
                  </div>
                )
            })}
          </div>
        )}
      </div>

      {/* 5. VLOŽENÍ UNIVERZÁLNÍHO MODÁLU */}
      <ConfirmModal 
        isOpen={!!noteToDelete} // Otevřeno, pokud máme ID ke smazání
        onClose={() => setNoteToDelete(null)}
        onConfirm={performDelete}
        title="Smazat poznámku"
        message="Opravdu chcete nenávratně odstranit tento záznam z deníku údržby?"
        confirmText="Smazat záznam"
      />

    </div>
  );
}

export default ServiceNotes;