import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import API from '../api/axios';

export default function PublicFolderPage() {
  const { id } = useParams();
  const [folder, setFolder] = useState(null);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFolder = async () => {
      try {
        const { data } = await API.get(`/folders/public/${id}/notes`);
        setFolder(data.folder);
        setNotes(data.notes);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchFolder();
  }, [id]);

  if (loading) return <div className="loading">Loading folder...</div>;
  if (!folder) return <div className="loading error">Folder not found or is private</div>;

  return (
    <div className="page-container">
      <div className="breadcrumb">
        <Link to="/search">Discover</Link>
        <span className="breadcrumb-sep">/</span>
        <span>{folder.name}</span>
      </div>

      <div className="page-header">
        <div>
          <h1>📁 {folder.name}</h1>
          <span className="badge public">Public</span>
        </div>
        {folder.owner?.name && (
          <p className="page-subtitle">by {folder.owner.name}</p>
        )}
      </div>

      {notes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📄</div>
          <h3>No notes in this folder</h3>
          <p>The folder owner hasn't uploaded any public notes yet</p>
        </div>
      ) : (
        <>
          <p className="results-count">{notes.length} public {notes.length === 1 ? 'note' : 'notes'}</p>
          <div className="grid">
            {notes.map((note) => (
              <div key={note._id} className="card">
                <div className="card-header">
                  <span className="card-icon">📄</span>
                  <span className="badge public">Public</span>
                </div>
                <h3 className="card-title">{note.filename}</h3>
                <div className="card-meta">
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
        </>
      )}
    </div>
  );
}