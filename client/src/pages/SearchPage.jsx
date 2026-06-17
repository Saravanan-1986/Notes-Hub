import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import API from '../api/axios';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [allPublic, setAllPublic] = useState([]);
  const [loadedAll, setLoadedAll] = useState(false);

  // Load all public notes on mount
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const { data } = await API.get('/notes/public/search');
        setAllPublic(data.notes);
      } catch (err) {
        console.error(err);
      }
    };
    fetchAll();
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setSearched(true);
    try {
      const { data } = await API.get(`/notes/public/search?q=${encodeURIComponent(query)}`);
      setResults(data.notes);
    } catch (err) {
      console.error(err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewAll = () => {
    setSearched(true);
    setLoadedAll(true);
    setResults(allPublic);
  };

  const displayNotes = searched ? results : allPublic;
  const isShowing = searched ? (loadedAll ? 'all public notes' : `results for "${query}"`) : 'recent public notes';

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Search Public Notes</h1>
      </div>

      <form onSubmit={handleSearch} className="search-bar">
        <div className="search-input-wrapper">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by filename or folder name..."
            className="search-input"
          />
        </div>
        <div className="search-actions">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Searching...' : 'Search'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleViewAll}>
            View All
          </button>
        </div>
      </form>

      {displayNotes.length > 0 && (
        <p className="results-count">
          Showing {displayNotes.length} {isShowing}
        </p>
      )}

      <div className="grid">
        {displayNotes.map((note) => (
          <div key={note._id} className="card search-card">
            <div className="card-header">
              <span className="card-icon">📄</span>
              <span className={`badge ${note.visibility}`}>
                {note.visibility}
              </span>
            </div>
            <h3 className="card-title">{note.filename}</h3>
            <div className="card-meta">
              <p className="meta-item">📁 {note.folderId?.name || 'Unknown'}</p>
              <p className="meta-item">👤 {note.owner?.name || 'Unknown'}</p>
              {note.fileSize && (
                <p className="meta-item">
                  {(note.fileSize / 1024 / 1024).toFixed(1)} MB
                </p>
              )}
            </div>
            <p className="card-date">
              {new Date(note.uploadedAt).toLocaleDateString()}
            </p>
            <div className="card-actions">
              <Link to={`/note/${note._id}`} className="btn btn-sm btn-primary">
                View Note
              </Link>
            </div>
          </div>
        ))}
      </div>

      {displayNotes.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <h3>No public notes found</h3>
          <p>
            {searched
              ? 'Try a different search term or browse all public notes'
              : 'No public notes have been shared yet'}
          </p>
        </div>
      )}
    </div>
  );
}