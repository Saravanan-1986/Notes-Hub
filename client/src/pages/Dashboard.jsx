import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import API from '../api/axios';

export default function Dashboard() {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newFolder, setNewFolder] = useState({ name: '', visibility: 'private' });
  const navigate = useNavigate();

  const fetchFolders = async () => {
    try {
      const { data } = await API.get('/folders');
      setFolders(data.folders);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFolders(); }, []);

  const createFolder = async (e) => {
    e.preventDefault();
    try {
      await API.post('/folders', newFolder);
      setNewFolder({ name: '', visibility: 'private' });
      setShowCreate(false);
      fetchFolders();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create folder');
    }
  };

  const deleteFolder = async (id) => {
    if (!window.confirm('Delete this folder and all its notes? This cannot be undone.')) return;
    try {
      await API.delete(`/folders/${id}`);
      fetchFolders();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete folder');
    }
  };

  if (loading) return <div className="loading">Loading folders...</div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>My Folders</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + New Folder
        </button>
      </div>

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Create New Folder</h2>
            <form onSubmit={createFolder}>
              <div className="form-group">
                <label>Folder Name</label>
                <input
                  type="text"
                  value={newFolder.name}
                  onChange={(e) => setNewFolder({ ...newFolder, name: e.target.value })}
                  required
                  placeholder="e.g. DBMS, Operating Systems"
                />
              </div>
              <div className="form-group">
                <label>Visibility</label>
                <select
                  value={newFolder.visibility}
                  onChange={(e) => setNewFolder({ ...newFolder, visibility: e.target.value })}
                >
                  <option value="private">Private (only you)</option>
                  <option value="public">Public (visible to everyone)</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {folders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📁</div>
          <h3>No folders yet</h3>
          <p>Create your first folder to start organizing your notes</p>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            Create Folder
          </button>
        </div>
      ) : (
        <div className="grid">
          {folders.map((folder) => (
            <div key={folder._id} className="card">
              <div className="card-header">
                <span className="card-icon">
                  {folder.visibility === 'public' ? '🌍' : '🔒'}
                </span>
                <span className={`badge ${folder.visibility}`}>{folder.visibility}</span>
              </div>
              <h3 className="card-title">{folder.name}</h3>
              <p className="card-date">
                Created {new Date(folder.createdAt).toLocaleDateString()}
              </p>
              <div className="card-actions">
                <Link to={`/folder/${folder._id}`} className="btn btn-sm btn-primary">
                  Open
                </Link>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => deleteFolder(folder._id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}