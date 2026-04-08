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
  const [token, setToken] = useState(sessionStorage.getItem('token'));
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      try {
        const decoded = jwtDecode(token);
        // decoded.sub bývá v FastAPI username, decoded.role je role
        setCurrentUser({
          name: decoded.sub,
          role: decoded.role
        });
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
        <div className={"app-wrapper ${!token ? 'blurred' : ''}"}>
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
                <div className="user-avatar">
                  {currentUser?.name?.substring(0, 2).toUpperCase() || '??'}
                </div>
                <div className="user-details">
                  <span className="user-name">{currentUser?.name || 'User'}</span>
                  <span className="user-role">
                    {currentUser?.role === 'admin' && 'Admin'}
                    {currentUser?.role === 'operator' && 'Operator'}
                    {currentUser?.role === 'user' && 'User'}
                  </span>
                </div>
                <button className="btn-logout-red" onClick={handleLogout}>
                  Log out
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