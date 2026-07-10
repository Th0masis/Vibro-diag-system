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
        const res = await axios.get(`/machines/${machineId}/notes`);
        setNotes(res.data);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };
  useEffect(() => { fetchNotes(); }, [machineId]);

  const handleSubmit = async (e) => { /* ... stejné jako dřív ... */
    e.preventDefault();
    if (!newNote.trim()) return;
    try {
        await axios.post(`/machines/${machineId}/notes`, { content: newNote, severity });
        setNewNote(""); setSeverity("INFO"); fetchNotes(); 
        if (onNoteAdded) onNoteAdded();
    } catch (err) { alert("Failed to save note: " + (err.response?.data?.detail || err.message)); }
  };

  // 3. Tlačítko "X" jen nastaví ID a tím otevře modál
  const handleDeleteClick = (noteId) => {
    setNoteToDelete(noteId);
  };

  // 4. Skutečné smazání (volá se až z modálu)
  const performDelete = async () => {
    try {
      await axios.delete(`/machines/${machineId}/notes/${noteToDelete}`);
      fetchNotes();
      if (onNoteAdded) onNoteAdded();
    } catch (error) {
      alert('Failed to delete note.');
    } finally {
      setNoteToDelete(null); // Zavřít modál
    }
  };

  const getSeverityStyle = (sev) => { /* ... stejné ... */ 
    switch (sev) {
        case 'CRITICAL': return { bg: '#fee2e2', color: '#991b1b', border: 'var(--status-fault)' };
        case 'WARNING': return { bg: '#fef9c3', color: '#854d0e', border: 'var(--status-warning)' };
        default: return { bg: '#eff6ff', color: '#1e40af', border: '#3b82f6' };
      }
  };

  return (
    <div className="service-notes-layout">
      
      {/* ... Levá část formuláře beze změn ... */}
      <div>
        <h3 className="service-notes-heading">New record</h3>
        <form onSubmit={handleSubmit} className="service-notes-form">
            {/* ... inputy formuláře (zkopíruj si z minula) ... */}
            <div className="service-notes-field">
            <label className="service-notes-label">Severity</label>
            <div className="service-notes-severity-row">
              {['INFO', 'WARNING', 'CRITICAL'].map(lev => (
                <button key={lev} type="button" onClick={() => setSeverity(lev)} style={{ flex: 1, padding: '8px', border: `1px solid ${severity === lev ? (lev==='INFO'?'#3b82f6':lev==='WARNING'?'var(--status-warning)':'var(--status-fault)') : '#cbd5e1'}`, background: severity === lev ? '#fff' : '#f1f5f9', color: severity === lev ? 'black' : '#64748b', borderRadius: '6px', cursor: 'pointer', fontWeight: severity===lev?'bold':'normal' }}>{lev}</button>
              ))}
            </div>
          </div>
          <div className="service-notes-field">
            <textarea rows="5" value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Write details here…" className="service-notes-textarea" required />
          </div>
          <button type="submit" className="btn-diagnose service-notes-submit">Save note</button>
         </form>
      </div>

      {/* Right: History */}
      <div>
        <h3 className="service-notes-heading">Maintenance history</h3>
        {loading ? <p>Loading...</p> : (
          <div className="service-notes-list">
            {notes.map(note => {
                const style = getSeverityStyle(note.severity);
                return (
                  <div key={note.id_note} className="service-notes-item">
                    <div className="service-notes-item-time">
                      <div className="service-notes-item-date">{new Date(note.timestamp).toLocaleDateString()}</div>
                      <div>{new Date(note.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                    </div>
                    <div className="service-notes-item-content" style={{ borderColor: style.border }}>
                      <div className="service-notes-item-header">
                        <div>
                            <span className="service-notes-author">{note.author}</span>
                            <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px', background: style.bg, color: style.color, border: `1px solid ${style.border}` }}>{note.severity}</span>
                        </div>
                        <button 
                            onClick={() => handleDeleteClick(note.id_note)}
                            className="service-notes-delete"
                          title="Delete record"
                        >
                            ×
                        </button>
                      </div>
                      <p className="service-notes-text">{note.content}</p>
                    </div>
                  </div>
                )
            })}
          </div>
        )}
      </div>

      {/* 5. Reusable confirmation modal */}
      <ConfirmModal 
        isOpen={!!noteToDelete} // Otevřeno, pokud máme ID ke smazání
        onClose={() => setNoteToDelete(null)}
        onConfirm={performDelete}
        title="Delete note"
        message="Are you sure you want to permanently delete this maintenance record? This cannot be undone."
        confirmText="Delete record"
      />

    </div>
  );
}

export default ServiceNotes;