import { useState, useEffect } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

import ConfirmModal from '../components/ConfirmModal';

function UserManagement() {
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

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/users');
      setUsers(response.data);
    } catch (error) {
      console.error("Nelze načíst uživatele:", error);
    } finally {
      setLoading(false);
    }
  };
  const formatDate = (dateString) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleString('cs-CZ', {
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
    } catch (error) {
      alert('Failed to delete user: ' + error.response?.data?.detail);
      setUserToDelete(null);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/users', newUser);
      setIsAddModalOpen(false);
      setNewUser({ username: '', password: '', email: '', role: 'user' }); // Reset
      fetchUsers(); // Znovu načíst tabulku
    } catch (error) {
      alert("Chyba: " + error.response?.data?.detail);
    }
  };

  const startEdit = (user) => {
    setEditingUser({ ...user }); // Vytvoříme kopii dat uživatele do stavu
  };  

  const handleUpdateUser = async (e) => {
    e.preventDefault();
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
      fetchUsers();
    } catch (error) {
      alert('Update failed: ' + error.response?.data?.detail);
    }
  };

  useEffect(() => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setIsAdmin(decoded.role === 'admin');
      } catch (error) {
        console.error("Chyba při dekódování tokenu:", error);
      }
    }
    fetchUsers();
  }, []);



  return (
    <div className="page-container">
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ color: 'var(--br-orange-dark)', margin: 0 }}>Team</h2>
        {isAdmin &&(
          <button 
            className="btn-diagnose" 
            onClick={() => setIsAddModalOpen(true)}
          >
            + Add user
          </button>  
        )}
      </div>

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
                      <td style={{ textAlign: 'center' }}>
                        <button className="btn-small-edit" onClick={() => startEdit(user)}>Edit</button>
                        <button className="btn-small-delete" onClick={() => setUserToDelete(user.id_user)}>Delete</button>
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
                  onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                  required 
                />
              </div>
              <div className="form-group">
                <input 
                  type="email" 
                  placeholder="E-mail" 
                  value={newUser.email}
                  onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                  required 
                />
              </div>
              <div className="form-group">
                <input 
                  type="password" 
                  placeholder="Password" 
                  value={newUser.password}
                  onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                  required 
                />
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
                <button type="button" className="btn-cancel" onClick={() => setIsAddModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-add-confirm">Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {editingUser && (
        <div className="modal-overlay">
          <div className="modal-content add-user-modal" style={{ borderTop: '6px solid var(--primary)' }}>
            <h2 style={{ marginBottom: '20px', color: 'var(--primary)' }}>Edit user</h2>
            <form onSubmit={handleUpdateUser}>
              <div className="form-group">
                <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', textAlign: 'left', marginBottom: '5px' }}>
                  Username (fixed - can't be changed)
                </label>
                <input 
                  type="text" 
                  value={editingUser.username} 
                  disabled 
                  style={{ background: '#f1f5f9', cursor: 'not-allowed' }}
                />
              </div>
              <div className="form-group">
                <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', textAlign: 'left', marginBottom: '5px' }}>
                  E-mail
                </label>
                <input 
                  type="email" 
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                  required 
                />
              </div>
              <div className="form-group" style={{ marginTop: '20px', padding: '15px', background: '#fef2f2', borderRadius: '8px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--status-fault)', fontWeight: 'bold', display: 'block', textAlign: 'left', marginBottom: '5px' }}>
                  Password change (optional)
                </label>
                <input 
                  type="password" 
                  placeholder="Leave empty to keep old password"
                  value={editingUser.password || ''}
                  onChange={(e) => setEditingUser({...editingUser, password: e.target.value})}
                  style={{ borderColor: 'var(--status-fault)' }}
                />
                <small style={{ display: 'block', textAlign: 'left', color: '#64748b', marginTop: '5px' }}>
                  If you fill this, the password will be changed
                </small>
              </div>
              <div className="form-group">
                <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', textAlign: 'left', marginBottom: '5px' }}>
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
                <button type="button" className="btn-cancel" onClick={() => setEditingUser(null)}>Cancel</button>
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