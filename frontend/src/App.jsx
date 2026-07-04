import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import axios from 'axios';
import Login from './components/Login';
import Dashboard from './pages/Dashboard';
import UserManagement from './pages/UserManagement';
import Sensors from './pages/Sensors';
import Machines from './pages/Machines';
import MachineDetail from './pages/MachineDetail';
import MlSector from './pages/MlSector'

// Loga (předpokládám cesty v src/assets)
import PulseGuardLogo from './assets/logo-pulseguard.svg';
import PulseGuardLogoNoText from './assets/logo-pulseguard_notext.svg';
import BrLogo from './assets/logo-br.svg';
import VutLogo from './assets/logo-vut.svg';

function App() {
  const [token, setToken] = useState(() => {
    // Set auth header synchronously on init so child components' useEffects
    // have the header available immediately on hard refresh.
    const t = sessionStorage.getItem('token');
    if (t) axios.defaults.headers.common['Authorization'] = `Bearer ${t}`;
    return t;
  });
  const [currentUser, setCurrentUser] = useState(() => {
    const t = sessionStorage.getItem('token');
    if (!t) return null;
    try {
      const decoded = jwtDecode(t);
      return { name: decoded.sub, role: decoded.role };
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      try {
        const decoded = jwtDecode(token);
        setCurrentUser({ name: decoded.sub, role: decoded.role });
      } catch (e) {
        console.error("Chyba dekódování:", e);
        handleLogout();
      }
    }
  }, [token]);

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    setToken(null);
    delete axios.defaults.headers.common['Authorization'];
  };
  return (
    <BrowserRouter>
      <div className="app-layout">
        <div className={`app-wrapper ${!token ? 'blurred' : ''}`}>
          {/* HEADER + NAV — sticky together to prevent layout shift on page change */}
          <div className="sticky-top">
          <header className="main-header">
            <div className="header-left">
              {/* Logo a Textový název */}
              <div className="brand-wrapper">
                <img src={PulseGuardLogoNoText} alt="" className="header-logo" />
                <span className="brand-text">
                  <span className="text-pulse">PULSE</span>
                  <span className="text-guard">GUARD</span>
                </span>
              </div>
            </div>

            <div className="header-right">
              <div className="user-profile">
                <div className="user-avatar" title={currentUser?.name}>
                  {currentUser?.name?.substring(0, 2).toUpperCase() || (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  )}
                </div>
                <div className="user-details">
                  <span className="user-name">{currentUser?.name || 'Unknown user'}</span>
                  <span className="user-role">
                    {currentUser?.role === 'admin' && 'Administrator'}
                    {currentUser?.role === 'operator' && 'Operator'}
                    {currentUser?.role === 'user' && 'Viewer'}
                  </span>
                </div>
                <button className="btn-logout" onClick={handleLogout} aria-label="Sign out from application">
                  Sign out
                </button>
              </div>
            </div>
          </header>

          {/* NAVIGATION MENU */}
          <nav className="nav-menu" aria-label="Main navigation">
            <NavLink to="/" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"} aria-current={({ isActive }) => isActive ? "page" : undefined}>
              <svg className="nav-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              Dashboard
            </NavLink>
            <NavLink to="/machines" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"} aria-current={({ isActive }) => isActive ? "page" : undefined}>
              <svg className="nav-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="2" x2="9" y2="4"/><line x1="15" y1="2" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="22"/><line x1="15" y1="20" x2="15" y2="22"/><line x1="20" y1="9" x2="22" y2="9"/><line x1="20" y1="14" x2="22" y2="14"/><line x1="2" y1="9" x2="4" y2="9"/><line x1="2" y1="14" x2="4" y2="14"/></svg>
              Machines
            </NavLink>
            <NavLink to="/sensors" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"} aria-current={({ isActive }) => isActive ? "page" : undefined}>
              <svg className="nav-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              Sensors
            </NavLink>
            <NavLink to="/ml-sector" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"} aria-current={({ isActive }) => isActive ? "page" : undefined}>
              <svg className="nav-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
              AI Models
            </NavLink>
            <NavLink to="/users" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"} aria-current={({ isActive }) => isActive ? "page" : undefined}>
              <svg className="nav-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
              Team
            </NavLink>
          </nav>
          </div>

          {/* MAIN CONTENT AREA */}
          <main className="main-content" role="main" aria-label="Main application content">
            <Routes>
              <Route path="/" element={<Dashboard token={token} />} />
              <Route path="/machines" element={<Machines />} />
              <Route path="/sensors" element={<Sensors />} />
              <Route path="/ml-sector" element={<MlSector />} />
              <Route path="/users" element={<UserManagement />} />
              <Route path="*" element={<Navigate to="/" />} />
              <Route path="/machines/:id" element={<MachineDetail />} />
            </Routes>
          </main>

          {/* FOOTER */}
          <footer className="main-footer">
            <div className="footer-left">
              <p>© {new Date().getFullYear()} | Diplomová práce: PulseGuard</p>
            </div>
            <div className="footer-right">
              <img src={PulseGuardLogo} alt="PulseGuard" className="footer-logo" />
              <img src={BrLogo} alt="B&R" className="footer-logo" />
              <img src={VutLogo} alt="VUT" className="footer-logo" />
            </div>
          </footer>
        </div>
        {!token &&(
          <div className="login-overlay">
            <Login setToken={setToken} />
          </div>
        )}
      </div>
    </BrowserRouter>
  );
}

export default App;