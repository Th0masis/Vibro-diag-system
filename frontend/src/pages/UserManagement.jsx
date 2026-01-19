import { useState, useEffect } from 'react';
import axios from 'axios';

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get('http://127.0.0.1:8000/users');
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

  useEffect(() => {
    fetchUsers();
  }, []);



  return (
    <div className="page-container">
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ color: 'var(--text)', margin: 0 }}>User Management</h2>
        <button className="btn-diagnose" onClick={() => alert("Zatím nefunkční: Zde bude formulář")}>
          + Add user
        </button>
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
                <th style={{ textAlign: 'center' }}>Action</th>
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
                    <td style={{ fontSize: '0.85rem', color: '#64748b' }}>
                    {formatDate(user.creation_time)}
                    </td>
                    <td style={{ fontSize: '0.85rem', color: '#64748b' }}>
                    {formatDate(user.last_login)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                    <button className="btn-small-edit">Edit</button>
                    <button className="btn-small-delete">Delete</button>
                    </td>
                </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default UserManagement;