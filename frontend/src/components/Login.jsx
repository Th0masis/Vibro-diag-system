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
      const response = await axios.post('/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      const token = response.data.access_token;
      sessionStorage.setItem('token', token);
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
          <label htmlFor="username" className="form-label required">Username</label>
          <input 
            type="text" 
            id="username"
            className="form-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g., operator@factory.local"
            aria-describedby={error ? "login-error" : undefined}
            required 
          />
        </div>

        <div className="form-group">
          <label htmlFor="password" className="form-label required">Password</label>
          <div style={{ position: 'relative' }}>
            <input 
              type={showPassword ? "text" : "password"} 
              id="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              aria-describedby={error ? "login-error" : undefined}
              required 
            />
            <button 
              type="button" 
              className="password-toggle" 
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
            >
              <img 
                src={ViewIcon} 
                alt=""
                className={`toggle-icon-img ${showPassword ? 'active' : ''}`} 
                aria-hidden="true"
              />
            </button>
          </div>
        </div>

        {error && <p className="error-message" id="login-error" role="alert">{error}</p>}

        <button type="submit" className={`login-btn ${loading ? 'loading' : ''}`} aria-busy={loading}>
          <span className="btn-text">Sign In</span>
          {loading && <span className="loading-spinner" aria-hidden="true"></span>}
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