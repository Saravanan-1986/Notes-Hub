import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import API from '../api/axios';
import BackButton from '../components/BackButton';

export default function GroupsPage() {
  const [myGroups, setMyGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [searchCode, setSearchCode] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const fetchMyGroups = async () => {
    try {
      const { data } = await API.get('/groups');
      setMyGroups(data.groups);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMyGroups(); }, []);

  const createGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    try {
      const { data } = await API.post('/groups', { name: newGroupName });
      setNewGroupName('');
      setShowCreate(false);
      navigate(`/group/${data.group._id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create group');
    }
  };

  const handleSearchCode = async (e) => {
    e.preventDefault();
    if (!searchCode.trim()) return;
    setSearching(true);
    setSearchResult(null);
    setError('');
    try {
      const { data } = await API.get(`/groups/search?code=${encodeURIComponent(searchCode.trim().toUpperCase())}`);
      if (data.found) {
        setSearchResult(data);
      } else {
        setSearchResult(data);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleJoinGroup = async (code) => {
    try {
      const { data } = await API.post('/groups/join', { code });
      setSearchResult(null);
      setSearchCode('');
      fetchMyGroups();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to join group');
    }
  };

  const handleLeaveGroup = async (groupId) => {
    if (!window.confirm('Are you sure you want to leave this group?')) return;
    try {
      await API.post(`/groups/${groupId}/leave`);
      fetchMyGroups();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to leave group');
    }
  };

  if (loading) return <div className="loading">Loading groups...</div>;

  return (
    <div className="page-container">
      <BackButton to="/dashboard" label="Dashboard" />
      <div className="page-header">
        <h1>👥 Groups</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + New Group
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Search Group by Code */}
      <div className="search-section">
        <h3 style={{ marginBottom: '16px', fontFamily: 'var(--font-display)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          🔍 Search Group by Code
        </h3>
        <form onSubmit={handleSearchCode} className="search-bar">
          <div className="search-input-wrapper">
            <span className="search-icon">🔑</span>
            <input
              type="text"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
              placeholder="Enter 8-character group code..."
              className="search-input"
              maxLength={8}
              style={{ textTransform: 'uppercase', letterSpacing: '0.15em' }}
            />
          </div>
          <div className="search-actions">
            <button type="submit" className="btn btn-primary" disabled={searching}>
              {searching ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>

        {/* Search Result */}
        {searchResult && (
          <div className="group-search-result" style={{ marginTop: '16px' }}>
            {searchResult.found ? (
              <div className="card" style={{ marginBottom: 0 }}>
                <div className="card-header">
                  <span className="card-icon">👥</span>
                  {searchResult.alreadyMember ? (
                    <span className="badge public">Member</span>
                  ) : (
                    <span className="badge" style={{
                      background: 'rgba(0, 212, 255, 0.1)',
                      color: 'var(--secondary)',
                      border: '1px solid rgba(0, 212, 255, 0.2)'
                    }}>Found</span>
                  )}
                </div>
                <h3 className="card-title">{searchResult.group.name}</h3>
                <div className="card-meta">
                  <p className="meta-item">👤 Admin: {searchResult.group.admin?.name}</p>
                  <p className="meta-item">👥 {searchResult.group.memberCount} members</p>
                  <p className="meta-item">🔑 Code: <strong style={{ letterSpacing: '0.2em', color: 'var(--primary-light)' }}>{searchResult.group.code}</strong></p>
                </div>
                <p className="card-date">Created {new Date(searchResult.group.createdAt).toLocaleDateString()}</p>
                <div className="card-actions">
                  {searchResult.alreadyMember ? (
                    <Link to={`/group/${searchResult.group._id}`} className="btn btn-sm btn-primary">
                      Open Group
                    </Link>
                  ) : (
                    <button
                      className="btn btn-sm btn-accent"
                      onClick={() => handleJoinGroup(searchResult.group.code)}
                    >
                      ➕ Join Group
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="group-not-found" style={{
                padding: '20px',
                textAlign: 'center',
                color: 'var(--text-tertiary)',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(255,255,255,0.06)'
              }}>
                <p style={{ fontSize: '1.1rem', marginBottom: '4px' }}>🔑</p>
                <p>No group found with code <strong style={{ color: 'var(--text-secondary)' }}>{searchCode}</strong></p>
                <p style={{ fontSize: '0.85rem', marginTop: '8px' }}>Check the code and try again</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Create New Group</h2>
            <form onSubmit={createGroup}>
              <div className="form-group">
                <label>Group Name</label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  required
                  placeholder="e.g. DBMS Study Group"
                />
              </div>
              <div className="section-divider" />
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">Create Group</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* My Groups */}
      <h2 style={{
        fontFamily: 'var(--font-display)',
        fontSize: '1.3rem',
        marginBottom: '20px',
        color: 'var(--text-primary)',
        letterSpacing: '-0.02em'
      }}>
        My Groups
      </h2>

      {myGroups.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">👥</div>
          <h3>No groups yet</h3>
          <p>Create a group or join one using an invite code</p>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            Create Group
          </button>
        </div>
      ) : (
        <div className="grid">
          {myGroups.map((group) => (
            <div key={group._id} className="card">
              <div className="card-header">
                <span className="card-icon">👥</span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {group.isAdmin && (
                    <span className="badge" style={{
                      background: 'rgba(108, 99, 255, 0.12)',
                      color: 'var(--primary-light)',
                      border: '1px solid rgba(108, 99, 255, 0.2)'
                    }}>Admin</span>
                  )}
                  {group.canUpload && !group.isAdmin && (
                    <span className="badge" style={{
                      background: 'rgba(0, 212, 255, 0.1)',
                      color: 'var(--secondary)',
                      border: '1px solid rgba(0, 212, 255, 0.2)'
                    }}>⭐ Upload</span>
                  )}
                </div>
              </div>
              <h3 className="card-title">{group.name}</h3>
              <div className="card-meta">
                <p className="meta-item">👤 {group.admin?.name || 'Unknown'}</p>
                <p className="meta-item">👥 {group.memberCount} member{group.memberCount !== 1 ? 's' : ''}</p>
                <p className="meta-item">🔑 <code style={{ letterSpacing: '0.2em', color: 'var(--primary-light)' }}>{group.code}</code></p>
              </div>
              <p className="card-date">Created {new Date(group.createdAt).toLocaleDateString()}</p>
              <div className="card-actions">
                <Link to={`/group/${group._id}`} className="btn btn-sm btn-primary">
                  Open
                </Link>
                {!group.isAdmin && (
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => handleLeaveGroup(group._id)}
                  >
                    Leave
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}