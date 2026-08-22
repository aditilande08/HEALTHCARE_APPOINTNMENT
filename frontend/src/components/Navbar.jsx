import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut } from 'lucide-react';
import logo from '../assets/logo.png';

export default function Navbar() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="brand" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <img src={logo} alt="Health Is Aura Logo" style={{ height: '40px', width: 'auto', borderRadius: '50%' }} />
          <span>Health Is Aura</span>
        </Link>

        {isAuthenticated ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <ul className="nav-links">
              {user.role === 'PATIENT' && (
                <>
                  <li>
                    <Link to="/patient" className={`nav-link ${location.pathname === '/patient' ? 'active' : ''}`}>
                      My Appointments
                    </Link>
                  </li>
                  <li>
                    <Link to="/patient/doctors" className={`nav-link ${isActive('/patient/doctors') ? 'active' : ''}`}>
                      Find Doctors
                    </Link>
                  </li>
                </>
              )}

              {user.role === 'DOCTOR' && (
                <>
                  <li>
                    <Link to="/doctor" className={`nav-link ${location.pathname === '/doctor' ? 'active' : ''}`}>
                      Schedule & Visits
                    </Link>
                  </li>
                  <li>
                    <Link to="/doctor/settings" className={`nav-link ${isActive('/doctor/settings') ? 'active' : ''}`}>
                      Google Calendar
                    </Link>
                  </li>
                </>
              )}

              {user.role === 'ADMIN' && (
                <>
                  <li>
                    <Link to="/admin" className={`nav-link ${isActive('/admin') ? 'active' : ''}`}>
                      Manage Doctors & Leave
                    </Link>
                  </li>
                </>
              )}
            </ul>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-subtle)', padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-full)' }}>
                <User size={16} color="var(--primary-600)" />
                <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{user.name}</span>
                <span className="badge" style={{ fontSize: '0.65rem', background: 'white', color: 'var(--primary-700)' }}>
                  {user.role}
                </span>
              </div>

              <button onClick={handleLogout} className="btn btn-secondary btn-sm" title="Log out">
                <LogOut size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Link to="/login" className="btn btn-secondary btn-sm">
              Log in
            </Link>
            <Link to="/register" className="btn btn-primary btn-sm">
              Sign up as Patient
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
