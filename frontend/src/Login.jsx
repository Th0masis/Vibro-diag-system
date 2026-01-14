import { useState } from 'react';
import axios from 'axios';
import './App.css';

// Import log
import PulseGuardLogo from './assets/logo-pulseguard.svg';
import BrLogo from './assets/logo-br.svg';
import VutLogo from './assets/logo-vut.svg';

function Login({ setToken }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // FastAPI očekává form-data, ne JSON, proto použijeme URLSearchParams
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    try {
      const response = await axios.post('http://127.0.0.1:8000/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      
      const token = response.data.access_token;
      localStorage.setItem('token', token); // Uložíme do prohlížeče
      setToken(token); // Aktualizujeme stav v App.jsx
    } catch (err) {
      setError('Nesprávné jméno nebo heslo');
    }
  };

  return (
    <div className="login-card">
        <div className="login-logo-header">
            <img src={PulseGuardLogo} alt="PulseGuard Logo" className="pulseguard-logo" />
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label>Uživatelské jméno</label>
            <input 
              type="text" 
              className="btn-update" 
              style={{ width: '100%', padding: '10px', marginTop: '5px' }}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label>Heslo</label>
            <input 
              type="password" 
              className="btn-update" 
              style={{ width: '100%', padding: '10px', marginTop: '5px' }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p style={{ color: '#FF4041', fontSize: '0.9rem' }}>{error}</p>}
          <button type="submit" className="btn-diagnose" style={{ width: '100%', marginTop: '10px' }}>
            Přihlásit se
          </button>
        </form>
        <p style={{ textAlign: 'center', fontSize: '0.8rem', marginTop: '20px', color: '#64748b' }}>
          B&R Industrial Automation | VUT Brno
        </p>
        <div className="login-footer-logos">
            <img src={BrLogo} alt="B&R Industrial Automation Logo" className="partner-logo" />
            <img src={VutLogo} alt="VUT Brno Logo" className="partner-logo" />
        </div>
    </div>
  );
}

export default Login;