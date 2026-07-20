import { useState, useEffect } from 'react';
import axios from 'axios';
import { useToast } from './ToastProvider';

function ServiceNotes({ machineId, onNoteAdded }) {
  const toast = useToast();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [newDetail, setNewDetail] = useState('');
  const [severity, setSeverity] = useState("INFO");
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState(null);

  const parseNoteContent = (content) => {
    const normalized = (content || '').replace(/\r\n/g, '\n').trim();
    if (!normalized) return { title: 'Untitled message', detail: '' };

    const splitByParagraph = normalized.split('\n\n');
    if (splitByParagraph.length > 1) {
      return {
        title: splitByParagraph[0].trim() || 'Untitled message',
        detail: splitByParagraph.slice(1).join('\n\n').trim()
      };
    }

    const splitByLine = normalized.split('\n');
    if (splitByLine.length > 1) {
      return {
        title: splitByLine[0].trim() || 'Untitled message',
        detail: splitByLine.slice(1).join('\n').trim()
      };
    }

    return { title: normalized, detail: '' };
  };

  const selectedNote = notes.find(n => n.id_note === selectedNoteId) || notes[0] || null;

  const fetchNotes = async () => {
    try {
      const res = await axios.get(`/machines/${machineId}/notes`);
      const fetchedNotes = Array.isArray(res.data) ? res.data : [];
      setNotes(fetchedNotes);

      if (fetchedNotes.length > 0) {
        setSelectedNoteId((prev) => {
          const exists = fetchedNotes.some(n => n.id_note === prev);
          return exists ? prev : fetchedNotes[0].id_note;
        });
      } else {
        setSelectedNoteId(null);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetchNotes(); }, [machineId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const title = newTitle.trim();
    const detail = newDetail.trim();
    if (!title) return;

    const content = detail ? `${title}\n\n${detail}` : title;

    try {
      await axios.post(`/machines/${machineId}/notes`, { content, severity });
      setNewTitle('');
      setNewDetail('');
      setSeverity('INFO');
      setComposeOpen(false);
      fetchNotes();
      if (onNoteAdded) onNoteAdded();
    } catch (err) {
      toast.error('Failed to save note: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleDeleteClick = async (noteId) => {
    // Optimistic soft-delete: remove from the list immediately and offer Undo
    // instead of an "Are you sure?" dialog (low-risk, reversible action).
    const removedNote = notes.find((n) => n.id_note === noteId);
    setNotes((prev) => prev.filter((n) => n.id_note !== noteId));
    setSelectedNoteId((prev) => (prev === noteId ? null : prev));

    try {
      await axios.delete(`/machines/${machineId}/notes/${noteId}`);
      if (onNoteAdded) onNoteAdded();
      toast.undo('Maintenance record deleted.', async () => {
        try {
          await axios.post(`/machines/${machineId}/notes/${noteId}/restore`);
          fetchNotes();
          if (onNoteAdded) onNoteAdded();
          toast.success('Record restored.');
        } catch (error) {
          toast.error('Failed to restore record.');
        }
      });
    } catch (error) {
      toast.error('Failed to delete note.');
      if (removedNote) fetchNotes();
    }
  };

  const getSeverityStyle = (sev) => {
    switch (sev) {
      case 'CRITICAL': return { bg: '#fee2e2', color: '#991b1b', border: 'var(--status-fault)' };
      case 'WARNING': return { bg: '#fef9c3', color: '#854d0e', border: 'var(--status-warning)' };
      default: return { bg: '#eff6ff', color: '#1e40af', border: '#3b82f6' };
    }
  };

  return (
    <div className="service-notes-layout">
      <div className="service-notes-toolbar">
        <h3 className="service-notes-heading">Maintenance timeline</h3>
        <button
          type="button"
          className="btn-diagnose service-notes-add-btn"
          onClick={() => setComposeOpen(true)}
        >
          New message
        </button>
      </div>

      {loading ? (
        <div className="service-notes-empty">Loading notes…</div>
      ) : notes.length === 0 ? (
        <div className="service-notes-empty">
          No maintenance messages yet. Click <strong>New message</strong> to add the first one.
        </div>
      ) : (
        <div className="service-notes-timeline-layout">
          <div className="service-notes-timeline-list" role="list" aria-label="Maintenance timeline">
            {notes.map((note, idx) => {
              const parsed = parseNoteContent(note.content);
              const isActive = selectedNote?.id_note === note.id_note;
              const style = getSeverityStyle(note.severity);

              return (
                <button
                  key={note.id_note}
                  className={`service-notes-timeline-item ${isActive ? 'is-active' : ''}`}
                  onClick={() => setSelectedNoteId(note.id_note)}
                  style={{ '--timeline-dot': style.border }}
                  type="button"
                  role="listitem"
                >
                  <span className="service-notes-timeline-track" aria-hidden="true">
                    <span className="service-notes-timeline-dot"></span>
                    {idx < notes.length - 1 && <span className="service-notes-timeline-line"></span>}
                  </span>
                  <span className="service-notes-timeline-content">
                    <span className="service-notes-timeline-time">
                      {new Date(note.timestamp).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    <span className="service-notes-timeline-title">{parsed.title}</span>
                    <span className="service-notes-timeline-severity" style={{ background: style.bg, color: style.color, borderColor: style.border }}>
                      {note.severity}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {selectedNote && (
            <article className="service-notes-detail-card">
              <div className="service-notes-detail-header">
                <div>
                  <h4 className="service-notes-detail-title">{parseNoteContent(selectedNote.content).title}</h4>
                  <div className="service-notes-detail-meta">
                    <span>{selectedNote.author}</span>
                    <span>·</span>
                    <span>
                      {new Date(selectedNote.timestamp).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteClick(selectedNote.id_note)}
                  className="service-notes-delete"
                  title="Delete selected record"
                >
                  ×
                </button>
              </div>

              <p className="service-notes-detail-body">
                {parseNoteContent(selectedNote.content).detail || 'No additional details provided.'}
              </p>
            </article>
          )}
        </div>
      )}

      {composeOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="New maintenance message">
          <div className="modal-content service-notes-compose-modal" style={{ maxWidth: '620px', width: '92%' }}>
            <div className="service-notes-compose-header">
              <h3 className="service-notes-heading">New maintenance message</h3>
              <button className="service-notes-delete" onClick={() => setComposeOpen(false)} title="Close">
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="service-notes-form service-notes-form--modal">
              <div className="service-notes-field">
                <label className="service-notes-label">Title</label>
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Short title, e.g. Bearing replacement"
                  className="service-notes-input"
                  maxLength={140}
                  required
                />
              </div>

              <div className="service-notes-field">
                <label className="service-notes-label">Severity</label>
                <div className="service-notes-severity-row">
                  {['INFO', 'WARNING', 'CRITICAL'].map((lev) => (
                    <button
                      key={lev}
                      type="button"
                      onClick={() => setSeverity(lev)}
                      className={`service-notes-severity-btn ${severity === lev ? 'is-active' : ''}`}
                    >
                      {lev}
                    </button>
                  ))}
                </div>
              </div>

              <div className="service-notes-field">
                <label className="service-notes-label">Detail description</label>
                <textarea
                  rows="7"
                  value={newDetail}
                  onChange={(e) => setNewDetail(e.target.value)}
                  placeholder="Describe what happened, what was done, and any follow-up actions..."
                  className="service-notes-textarea"
                />
              </div>

              <div className="service-notes-modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setComposeOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-diagnose service-notes-submit">Save message</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default ServiceNotes;