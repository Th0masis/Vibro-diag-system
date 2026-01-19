import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import axios from 'axios';
import Login from './components/Login';
import Dashboard from './pages/Dashboard';

// Loga (předpokládám cesty v src/assets)
import PulseGuardLogo from './assets/logo-pulseguard.svg';
import PulseGuardLogoNoText from './assets/logo-pulseguard_notext.svg';
import BrLogo from './assets/logo-br.svg';
import VutLogo from './assets/logo-vut.svg';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  }, [token]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    delete axios.defaults.headers.common['Authorization'];
  };

  if (!token) {
    return (
      <div className="app-layout">
        <div className="app-container blurred">
            {/* Tady může být statické pozadí pro blur */}
        </div>
        <div className="login-overlay">
          <Login setToken={setToken} />
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="app-wrapper">
        {/* HEADER */}
        <header className="main-header">
          <div className="header-left">
            {/* Logo a Textový název */}
            <div className="brand-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img src={PulseGuardLogoNoText} alt="" className="header-logo" />
              <span className="brand-text">
                <span className="text-pulse">PULSE</span>
                <span className="text-guard">GUARD</span>
              </span>
            </div>
          </div>

          <div className="header-right">
            <div className="user-profile">
              <div className="user-avatar">AD</div> {/* Iniciály nebo ikonka */}
              <div className="user-details">
                <span className="user-name">Admin User</span>
                <span className="user-role">Diagnostik</span>
              </div>
              <button className="btn-logout-red" onClick={handleLogout}>
                Odhlásit se
              </button>
            </div>
          </div>
        </header>

        {/* NAVIGATION MENU */}
        <nav className="nav-menu">
          <NavLink to="/" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>Dashboard</NavLink>
          <NavLink to="/machines" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>Machines</NavLink>
          <NavLink to="/sensors" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>Sensors</NavLink>
          <NavLink to="/ml-sector" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>ML Sector</NavLink>
          <NavLink to="/users" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>User Management</NavLink>
        </nav>

        {/* MAIN CONTENT AREA */}
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/machines" element={<div className="placeholder">Správa strojů</div>} />
            <Route path="/sensors" element={<div className="placeholder">Přehled senzorů</div>} />
            <Route path="/ml-sector" element={<div className="placeholder">Analýza dat a trénování modelů</div>} />
            <Route path="/users" element={<div className="placeholder">Správa uživatelů</div>} />
            <Route path="*" element={<Navigate to="/" />} />
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
    </BrowserRouter>
  );
}

export default App;