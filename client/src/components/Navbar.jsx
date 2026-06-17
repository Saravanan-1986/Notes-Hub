import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/dashboard" className="navbar-brand">
          <span className="brand-icon">📚</span>
          <span className="brand-text">Notes Hub</span>
        </Link>
        <div className="navbar-links">
          <Link to="/search" className="nav-link">
            <span className="nav-icon">🔍</span>
            <span>Search Notes</span>
          </Link>
          {user && (
            <>
              <Link to="/dashboard" className="nav-link">
                <span className="nav-icon">📁</span>
                <span>My Folders</span>
              </Link>
              <div className="nav-user">
                <span className="nav-user-icon">👤</span>
                <span className="nav-username">{user.name}</span>
              </div>
              <button onClick={handleLogout} className="btn btn-logout">
                Logout
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}