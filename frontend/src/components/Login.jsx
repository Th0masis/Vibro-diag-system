import { useState } from 'react';
import axios from 'axios';
import '../App.css'; 

import PulseGuardLogo from '../assets/logo-pulseguard.svg';
import BrLogo from '../assets/logo-br.svg';
import VutLogo from '../assets/logo-vut.svg';
import ViewIcon from '../assets/view.png';

function Login({ setToken }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    try {
      const response = await axios.post('http://127.0.0.1:8000/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      const token = response.data.access_token;
      localStorage.setItem('token', token);
      setToken(token);
    } catch (err) {
      setError('Nesprávné jméno nebo heslo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-card">
      <div className="login-logo-header">
        <img src={PulseGuardLogo} alt="PulseGuard Logo" className="pulseguard-logo" />
      </div>

      <form className="login-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <div className="input-wrapper">
            {/* placeholder=" " je důležitý pro CSS validaci labelu */}
            <input 
              type="text" 
              id="username" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder=" " 
              required 
            />
            <label htmlFor="username">Username</label>
          </div>
        </div>

        <div className="form-group">
          <div className="input-wrapper">
            <input 
              type={showPassword ? "text" : "password"} 
              id="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder=" " 
              required 
            />
            <label htmlFor="password">Password</label>
            <button 
              type="button" 
              className="password-toggle" 
              onClick={() => setShowPassword(!showPassword)}
            >
              <img 
                src={ViewIcon} 
                alt="Zobrazit heslo" 
                className={`toggle-icon-img ${showPassword ? 'active' : ''}`} 
              />
            </button>
          </div>
        </div>

        {error && <p className="error-text-simple">{error}</p>}

        <button type="submit" className={`login-btn ${loading ? 'loading' : ''}`}>
          <span className="btn-text">Sign In</span>
          <span className="btn-loader"></span>
        </button>
      </form>
      <p className="footer-copyright">B&R Industrial Automation | VUT Brno</p>
      <div className="login-footer-logos">
        <img src={BrLogo} alt="B&R Logo" className="partner-logo" />
        <img src={VutLogo} alt="VUT Logo" className="partner-logo" />
      </div>
    </div>
  );
}

export default Login;