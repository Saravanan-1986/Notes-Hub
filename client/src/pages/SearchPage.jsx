import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import API from '../api/axios';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('files');
  const [fileResults, setFileResults] = useState([]);
  const [folderResults, setFolderResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Load initial data
  useEffect(() => {
    loadInitial();
  }, []);

  const loadInitial = async () => {
    try {
      const [filesRes, foldersRes] = await Promise.all([
        API.get('/notes/public/search'),
        API.get('/folders/public/search')
      ]);
      setFileResults(filesRes.data.notes);
      setFolderResults(foldersRes.data.folders);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);

    try {
      if (activeTab === 'files') {
        const { data } = await API.get(`/notes/public/search?q=${encodeURIComponent(query)}`);
        setFileResults(data.notes);
      } else {
        const { data } = await API.get(`/folders/public/search?q=${encodeURIComponent(query)}`);
        setFolderResults(data.folders);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewAll = async () => {
    setSearched(true);
    try {
      if (activeTab === 'files') {
        const { data } = await API.get('/notes/public/search');
        setFileResults(data.notes);
      } else {
        const { data } = await API.get('/folders/public/search');
        setFolderResults(data.folders);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Discover</h1>
        <p className="page-subtitle">Search public notes and folders shared by the community</p>
      </div>

      <div className="search-section">
        <form onSubmit={handleSearch} className="search-bar">
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={activeTab === 'files' ? 'Search notes by filename...' : 'Search folders by name...'}
              className="search-input"
            />
          </div>
          <div className="search-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Searching...' : 'Search'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleViewAll}>
              Browse All
            </button>
          </div>
        </form>
      </div>

      {/* Tabs */}
      <div className="search-tabs">
        <button
          className={`search-tab ${activeTab === 'files' ? 'active' : ''}`}
          onClick={() => { setActiveTab('files'); setSearched(false); }}
        >
          <span className="tab-icon">📄</span>
          Files
        </button>
        <button
          className={`search-tab ${activeTab === 'folders' ? 'active' : ''}`}
          onClick={() => { setActiveTab('folders'); setSearched(false); }}
        >
          <span className="tab-icon">📁</span>
          Folders
        </button>
      </div>

      {activeTab === 'files' ? (
        <>
          {fileResults.length > 0 && (
            <p className="results-count">{fileResults.length} public {fileResults.length === 1 ? 'note' : 'notes'} found</p>
          )}
          <div className="grid">
            {fileResults.map((note) => (
              <div key={note._id} className="card">
                <div className="card-header">
                  <span className="card-icon">📄</span>
                  <span className={`badge ${note.visibility}`}>Public</span>
                </div>
                <h3 className="card-title">{note.filename}</h3>
                <div className="card-meta">
                  <p className="meta-item">📁 {note.folderId?.name || 'Unknown'}</p>
                  <p className="meta-item">👤 {note.owner?.name || 'Unknown'}</p>
                  {note.fileSize && (
                    <p className="meta-item">📦 {(note.fileSize / 1024 / 1024).toFixed(1)} MB</p>
                  )}
                </div>
                <p className="card-date">{new Date(note.uploadedAt).toLocaleDateString()}</p>
                <div className="card-actions">
                  <Link to={`/note/${note._id}`} className="btn btn-sm btn-primary">View Note</Link>
                </div>
              </div>
            ))}
          </div>
          {fileResults.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">📄</div>
              <h3>No public notes found</h3>
              <p>{searched ? 'Try a different search term' : 'No public notes have been shared yet'}</p>
            </div>
          )}
        </>
      ) : (
        <>
          {folderResults.length > 0 && (
            <p className="results-count">{folderResults.length} public {folderResults.length === 1 ? 'folder' : 'folders'} found</p>
          )}
          <div className="grid">
            {folderResults.map((folder) => (
              <Link key={folder._id} to={`/public-folder/${folder._id}`} className="card folder-card">
                <div className="card-header">
                  <span className="card-icon">📁</span>
                  <span className="badge public">Public</span>
                </div>
                <h3 className="card-title">{folder.name}</h3>
                <div className="card-meta">
                  <p className="meta-item">👤 {folder.owner?.name || 'Unknown'}</p>
                  <p className="meta-item">📄 {folder.noteCount} {folder.noteCount === 1 ? 'note' : 'notes'}</p>
                </div>
                <p className="card-date">Created {new Date(folder.createdAt).toLocaleDateString()}</p>
                <span className="btn btn-sm btn-accent folder-browse">Browse Folder →</span>
              </Link>
            ))}
          </div>
          {folderResults.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">📁</div>
              <h3>No public folders found</h3>
              <p>{searched ? 'Try a different search term' : 'No public folders have been created yet'}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}