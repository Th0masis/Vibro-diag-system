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
  const [touched, setTouched] = useState({});
  const [errors, setErrors] = useState({});
  const [liveValidation, setLiveValidation] = useState({});

  const validateField = (field, value) => {
    const v = String(value || '').trim();
    if (field === 'username') return v ? '' : 'Username is required.';
    if (field === 'password') return v ? '' : 'Password is required.';
    return '';
  };

  const validateAll = () => {
    const nextErrors = {
      username: validateField('username', username),
      password: validateField('password', password),
    };
    setErrors(nextErrors);
    setTouched({ username: true, password: true });

    const failed = Object.entries(nextErrors).filter(([, msg]) => msg).map(([key]) => key);
    if (failed.length > 0) {
      setLiveValidation((prev) => ({
        ...prev,
        ...failed.reduce((acc, key) => ({ ...acc, [key]: true }), {}),
      }));
      return false;
    }
    return true;
  };

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const msg = validateField(field, field === 'username' ? username : password);
    setErrors((prev) => ({ ...prev, [field]: msg }));
    if (msg) setLiveValidation((prev) => ({ ...prev, [field]: true }));
  };

  const getInputClass = (field, value) => {
    if (!touched[field]) return 'form-input';
    if (errors[field]) return 'form-input form-input-error';
    if (String(value || '').trim()) return 'form-input form-input-success';
    return 'form-input';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateAll()) return;

    setLoading(true);

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
      setError('Incorrect username or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUsernameChange = (value) => {
    setUsername(value);
    if (liveValidation.username) {
      setErrors((prev) => ({ ...prev, username: validateField('username', value) }));
    }
  };

  const handlePasswordChange = (value) => {
    setPassword(value);
    if (liveValidation.password) {
      setErrors((prev) => ({ ...prev, password: validateField('password', value) }));
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
            className={getInputClass('username', username)}
            value={username}
            onChange={(e) => handleUsernameChange(e.target.value)}
            onBlur={() => handleBlur('username')}
            placeholder="e.g., operator@factory.local"
            aria-describedby={error ? "login-error" : undefined}
            aria-invalid={Boolean(touched.username && errors.username)}
            required 
          />
          {touched.username && errors.username && (
            <small className="form-helper-text error">{errors.username}</small>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="password" className="form-label required">Password</label>
          <div style={{ position: 'relative' }}>
            <input 
              type={showPassword ? "text" : "password"} 
              id="password"
              className={getInputClass('password', password)}
              value={password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              onBlur={() => handleBlur('password')}
              placeholder="Enter your password"
              aria-describedby={error ? "login-error" : undefined}
              aria-invalid={Boolean(touched.password && errors.password)}
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
          {touched.password && errors.password && (
            <small className="form-helper-text error">{errors.password}</small>
          )}
        </div>

        {error && <p className="error-message" id="login-error" role="alert">{error}</p>}

        <button type="submit" className={`login-btn ${loading ? 'loading' : ''}`} aria-busy={loading}>
          {loading ? (
            <><span className="loading-spinner" aria-hidden="true"></span><span>Signing in…</span></>
          ) : (
            <><span>Sign In</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></>
          )}
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