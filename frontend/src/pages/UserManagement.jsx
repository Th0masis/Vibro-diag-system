import { useState, useEffect } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

import ConfirmModal from '../components/ConfirmModal';
import { useToast } from '../components/ToastProvider';
import PageTitle from '../components/PageTitle';

function normalizeListPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.users)) return payload.users;
  return [];
}

function UserManagement() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userToDelete, setUserToDelete] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    email: '',
    role: 'user' // defaultní role
  });
  const [editingUser, setEditingUser] = useState(null);
  const [addTouched, setAddTouched] = useState({});
  const [addErrors, setAddErrors] = useState({});
  const [addLiveValidation, setAddLiveValidation] = useState({});
  const [editTouched, setEditTouched] = useState({});
  const [editErrors, setEditErrors] = useState({});
  const [editLiveValidation, setEditLiveValidation] = useState({});

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

  const validateAddField = (field, value) => {
    const v = String(value || '').trim();
    if (field === 'username') {
      if (!v) return 'Username is required.';
      if (v.length < 3) return 'Username must have at least 3 characters.';
      return '';
    }
    if (field === 'email') {
      if (!v) return 'E-mail is required.';
      if (!isValidEmail(v)) return 'Please enter a valid e-mail address.';
      return '';
    }
    if (field === 'password') {
      if (!v) return 'Password is required.';
      if (v.length < 8) return 'Password must have at least 8 characters.';
      return '';
    }
    return '';
  };

  const validateEditField = (field, value) => {
    const v = String(value || '').trim();
    if (field === 'email') {
      if (!v) return 'E-mail is required.';
      if (!isValidEmail(v)) return 'Please enter a valid e-mail address.';
      return '';
    }
    if (field === 'password') {
      if (!v) return '';
      if (v.length < 8) return 'If provided, password must have at least 8 characters.';
      return '';
    }
    return '';
  };

  const validateAddForm = () => {
    const nextErrors = {
      username: validateAddField('username', newUser.username),
      email: validateAddField('email', newUser.email),
      password: validateAddField('password', newUser.password),
    };
    setAddErrors(nextErrors);
    setAddTouched({ username: true, email: true, password: true });
    const failed = Object.entries(nextErrors).filter(([, msg]) => msg).map(([f]) => f);
    if (failed.length > 0) {
      setAddLiveValidation((prev) => ({ ...prev, ...failed.reduce((acc, f) => ({ ...acc, [f]: true }), {}) }));
      return false;
    }
    return true;
  };

  const validateEditForm = () => {
    const nextErrors = {
      email: validateEditField('email', editingUser?.email),
      password: validateEditField('password', editingUser?.password),
    };
    setEditErrors(nextErrors);
    setEditTouched({ email: true, password: true });
    const failed = Object.entries(nextErrors).filter(([, msg]) => msg).map(([f]) => f);
    if (failed.length > 0) {
      setEditLiveValidation((prev) => ({ ...prev, ...failed.reduce((acc, f) => ({ ...acc, [f]: true }), {}) }));
      return false;
    }
    return true;
  };

  const handleAddBlur = (field) => {
    setAddTouched((prev) => ({ ...prev, [field]: true }));
    const msg = validateAddField(field, newUser[field]);
    setAddErrors((prev) => ({ ...prev, [field]: msg }));
    if (msg) setAddLiveValidation((prev) => ({ ...prev, [field]: true }));
  };

  const handleEditBlur = (field) => {
    setEditTouched((prev) => ({ ...prev, [field]: true }));
    const msg = validateEditField(field, editingUser?.[field]);
    setEditErrors((prev) => ({ ...prev, [field]: msg }));
    if (msg) setEditLiveValidation((prev) => ({ ...prev, [field]: true }));
  };

  const getAddInputClass = (field, value) => {
    if (!addTouched[field]) return '';
    if (addErrors[field]) return 'form-input-error';
    if (String(value || '').trim()) return 'form-input-success';
    return '';
  };

  const getEditInputClass = (field, value) => {
    if (!editTouched[field]) return '';
    if (editErrors[field]) return 'form-input-error';
    if (String(value || '').trim()) return 'form-input-success';
    return '';
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/users');
      setUsers(normalizeListPayload(response.data));
    } catch (error) {
      console.error('Failed to load users:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };
  const formatDate = (dateString) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleString('en-GB', {
        dateStyle: 'short',
        timeStyle: 'short'
    });
  };

  const handleDelete = async () => {
    if (!userToDelete) return;
    try {
      await axios.delete(`/users/${userToDelete}`);
      // Po úspěšném smazání aktualizujeme seznam uživatelů
      setUsers(users.filter(u => u.id_user !== userToDelete));
      setUserToDelete(null); // Zavřít okno
      toast.success('User deleted.');
    } catch (error) {
      toast.error('Failed to delete user: ' + error.response?.data?.detail);
      setUserToDelete(null);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!validateAddForm()) {
      toast.warning('Please fix highlighted fields before creating user.');
      return;
    }
    try {
      await axios.post('/users', newUser);
      setIsAddModalOpen(false);
      setNewUser({ username: '', password: '', email: '', role: 'user' }); // Reset
      setAddTouched({});
      setAddErrors({});
      setAddLiveValidation({});
      fetchUsers(); // Znovu načíst tabulku
      toast.success('User created.');
    } catch (error) {
      toast.error('Error: ' + error.response?.data?.detail);
    }
  };

  const startEdit = (user) => {
    setEditingUser({ ...user }); // Vytvoříme kopii dat uživatele do stavu
    setEditTouched({});
    setEditErrors({});
    setEditLiveValidation({});
  };  

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!validateEditForm()) {
      toast.warning('Please fix highlighted fields before saving.');
      return;
    }
    try {
      const payload = {
        email: editingUser.email,
        role: editingUser.role
      };

      // Pokud admin zadal nějaký text do pole hesla, přidáme ho k datům
      if (editingUser.password && editingUser.password.trim() !== "") {
        payload.password = editingUser.password;
      }

      await axios.put(`/users/${editingUser.id_user}`, payload);
      setEditingUser(null);
      setEditTouched({});
      setEditErrors({});
      setEditLiveValidation({});
      fetchUsers();
      toast.success('User updated.');
    } catch (error) {
      toast.error('Update failed: ' + error.response?.data?.detail);
    }
  };

  useEffect(() => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setIsAdmin(decoded.role === 'admin');
      } catch (error) {
        console.error('Token decode failed:', error);
      }
    }
    fetchUsers();
  }, []);

  useEffect(() => {
    const liveFields = Object.keys(addLiveValidation).filter((f) => addLiveValidation[f]);
    if (liveFields.length === 0) return;
    setAddErrors((prev) => {
      const next = { ...prev };
      liveFields.forEach((field) => {
        next[field] = validateAddField(field, newUser[field]);
      });
      return next;
    });
  }, [newUser, addLiveValidation]);

  useEffect(() => {
    if (!editingUser) return;
    const liveFields = Object.keys(editLiveValidation).filter((f) => editLiveValidation[f]);
    if (liveFields.length === 0) return;
    setEditErrors((prev) => {
      const next = { ...prev };
      liveFields.forEach((field) => {
        next[field] = validateEditField(field, editingUser[field]);
      });
      return next;
    });
  }, [editingUser, editLiveValidation]);



  return (
    <div className="page-container">
      <PageTitle title="Team">
        {isAdmin &&(
          <button 
            className="btn-diagnose" 
            onClick={() => setIsAddModalOpen(true)}
          >
            + Add user
          </button>  
        )}
      </PageTitle>

      <div className="table-wrapper">
        {loading ? (
          <p style={{ padding: '20px' }}>Loading users...</p>
        ) : (
          <table>
            <thead>
                <tr>
                <th>ID</th>
                <th>User</th>
                <th>E-mail</th>
                <th>Role</th>
                <th>Created</th>
                <th>Last login</th>
                {isAdmin && <th style={{ textAlign: 'center' }}>Actions</th>}
                </tr>
            </thead>
            <tbody>
                {users.map((user) => (
                <tr key={user.id_user}>
                    <td>{user.id_user}</td>
                    <td><strong>{user.username}</strong></td>
                    <td>{user.email}</td>
                    <td>
                    <span className={`role-badge ${user.role}`}>
                        {user.role}
                    </span>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {formatDate(user.creation_time)}
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {formatDate(user.last_login)}
                    </td>
                    {isAdmin && (
                      <td className="table-actions-center">
                        <div className="machine-sensors-actions-wrap">
                          <button
                            className="sensor-btn sensor-btn-detail"
                            onClick={() => startEdit(user)}
                            title="Edit user"
                            aria-label="Edit user"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                            </svg>
                          </button>
                          <button
                            className="sensor-btn sensor-btn-delete"
                            onClick={() => setUserToDelete(user.id_user)}
                            title="Delete user"
                            aria-label="Delete user"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    )}
                </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
      {/* MODÁLNÍ OKNO PRO POTVRZENÍ SMAZÁNÍ */}
      <ConfirmModal 
        isOpen={!!userToDelete}
        onClose={() => setUserToDelete(null)}
        onConfirm={handleDelete}
        title="Confirm user deletion"
        message="Are you sure you want to permanently remove this user? This action cannot be undone."
      />
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content add-user-modal">
            <h2 style={{ marginBottom: '20px', color: 'var(--primary)' }}>New User</h2>
            <form onSubmit={handleAddUser}>
              <div className="form-group">
                <input 
                  type="text" 
                  placeholder="Username" 
                  value={newUser.username}
                  className={getAddInputClass('username', newUser.username)}
                  onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                  onBlur={() => handleAddBlur('username')}
                  aria-invalid={Boolean(addTouched.username && addErrors.username)}
                  required 
                />
                {addTouched.username && addErrors.username && (
                  <small className="form-helper-text error">{addErrors.username}</small>
                )}
              </div>
              <div className="form-group">
                <input 
                  type="email" 
                  placeholder="E-mail" 
                  value={newUser.email}
                  className={getAddInputClass('email', newUser.email)}
                  onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                  onBlur={() => handleAddBlur('email')}
                  aria-invalid={Boolean(addTouched.email && addErrors.email)}
                  required 
                />
                {addTouched.email && addErrors.email && (
                  <small className="form-helper-text error">{addErrors.email}</small>
                )}
              </div>
              <div className="form-group">
                <input 
                  type="password" 
                  placeholder="Password" 
                  value={newUser.password}
                  className={getAddInputClass('password', newUser.password)}
                  onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                  onBlur={() => handleAddBlur('password')}
                  aria-invalid={Boolean(addTouched.password && addErrors.password)}
                  required 
                />
                {addTouched.password && addErrors.password && (
                  <small className="form-helper-text error">{addErrors.password}</small>
                )}
              </div>
              <div className="form-group">
                <select 
                  value={newUser.role}
                  onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                >
                  <option value="user">User</option>
                  <option value="operator">Operator</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setAddTouched({});
                    setAddErrors({});
                    setAddLiveValidation({});
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-add-confirm">Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {editingUser && (
        <div className="modal-overlay">
          <div className="modal-content add-user-modal modal-content-primary-border">
            <h2 className="modal-title-primary modal-title-spaced">Edit user</h2>
            <form onSubmit={handleUpdateUser}>
              <div className="form-group">
                <label className="form-field-label">
                  Username (fixed - can't be changed)
                </label>
                <input 
                  type="text" 
                  value={editingUser.username} 
                  disabled 
                  className="form-input-disabled"
                />
              </div>
              <div className="form-group">
                <label className="form-field-label">
                  E-mail
                </label>
                <input 
                  type="email" 
                  value={editingUser.email}
                  className={getEditInputClass('email', editingUser.email)}
                  onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                  onBlur={() => handleEditBlur('email')}
                  aria-invalid={Boolean(editTouched.email && editErrors.email)}
                  required 
                />
                {editTouched.email && editErrors.email && (
                  <small className="form-helper-text error">{editErrors.email}</small>
                )}
              </div>
              <div className="form-group form-group-warning">
                <label className="form-field-label form-field-label-warning">
                  Password change (optional)
                </label>
                <input 
                  type="password" 
                  placeholder="Leave empty to keep old password"
                  value={editingUser.password || ''}
                  className={`form-input-warning ${getEditInputClass('password', editingUser.password || '')}`.trim()}
                  onChange={(e) => setEditingUser({...editingUser, password: e.target.value})}
                  onBlur={() => handleEditBlur('password')}
                  aria-invalid={Boolean(editTouched.password && editErrors.password)}
                />
                <small className="form-help-text">
                  If you fill this, the password will be changed
                </small>
                {editTouched.password && editErrors.password && (
                  <small className="form-helper-text error">{editErrors.password}</small>
                )}
              </div>
              <div className="form-group">
                <label className="form-field-label">
                  System role
                </label>
                <select 
                  value={editingUser.role}
                  onChange={(e) => setEditingUser({...editingUser, role: e.target.value})}
                >
                  <option value="user">User</option>
                  <option value="operator">Operator</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => {
                    setEditingUser(null);
                    setEditTouched({});
                    setEditErrors({});
                    setEditLiveValidation({});
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-add-confirm">Save changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserManagement;