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
          <span>Notes Hub</span>
        </Link>
        <div className="navbar-links">
          <Link to="/search" className="nav-link">
            <span className="nav-icon">🔍</span>
            <span>Search</span>
          </Link>
          {user && (
            <>
              <Link to="/dashboard" className="nav-link">
                <span className="nav-icon">📁</span>
                <span>Folders</span>
              </Link>
              <Link to="/groups" className="nav-link">
                <span className="nav-icon">👥</span>
                <span>Groups</span>
              </Link>
              <div className="nav-user">
                <div className="nav-user-avatar">
                  {user.name ? user.name.charAt(0) : '?'}
                </div>
                <span className="nav-username">{user.name}</span>
              </div>
              <button onClick={handleLogout} className="btn-logout">
                Logout
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}