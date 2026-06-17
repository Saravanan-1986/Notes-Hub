import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import API from '../api/axios';
import UploadModal from '../components/UploadModal';

export default function FolderPage() {
  const { folderId } = useParams();
  const [folder, setFolder] = useState(null);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  const fetchData = async () => {
    try {
      const [folderRes, notesRes] = await Promise.all([
        API.get('/folders'),
        API.get(`/notes/folder/${folderId}`)
      ]);
      const found = folderRes.data.folders.find(f => f._id === folderId);
      setFolder(found);
      setNotes(notesRes.data.notes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [folderId]);

  const deleteNote = async (noteId) => {
    if (!window.confirm('Delete this note? This will also remove it from GitHub.')) return;
    try {
      await API.delete(`/notes/${noteId}`);
      setNotes(notes.filter(n => n._id !== noteId));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete note');
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (loading) return <div className="loading">Loading notes...</div>;

  if (!folder) return <div className="loading">Folder not found</div>;

  return (
    <div className="page-container">
      <div className="breadcrumb">
        <Link to="/dashboard">My Folders</Link>
        <span className="breadcrumb-sep">/</span>
        <span>{folder.name}</span>
      </div>

      <div className="page-header">
        <div>
          <h1>{folder.name}</h1>
          <span className={`badge ${folder.visibility}`}>{folder.visibility}</span>
        </div>
        <button className="btn btn-primary" onClick={() => setShowUpload(true)}>
          + Upload PDF
        </button>
      </div>

      {showUpload && (
        <UploadModal
          folderId={folderId}
          onClose={() => setShowUpload(false)}
          onUpload={() => { setShowUpload(false); fetchData(); }}
        />
      )}

      {notes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📄</div>
          <h3>No notes in this folder</h3>
          <p>Upload your first PDF note to get started</p>
          <button className="btn btn-primary" onClick={() => setShowUpload(true)}>
            Upload PDF
          </button>
        </div>
      ) : (
        <div className="notes-table">
          <div className="notes-table-header">
            <span className="col-name">File Name</span>
            <span className="col-size">Size</span>
            <span className="col-visibility">Visibility</span>
            <span className="col-date">Uploaded</span>
            <span className="col-actions">Actions</span>
          </div>
          {notes.map((note) => (
            <div key={note._id} className="notes-table-row">
              <span className="col-name">
                <span className="file-icon">📄</span>
                {note.filename}
              </span>
              <span className="col-size">{formatSize(note.fileSize)}</span>
              <span className="col-visibility">
                <span className={`badge ${note.visibility}`}>{note.visibility}</span>
              </span>
              <span className="col-date">
                {new Date(note.uploadedAt).toLocaleDateString()}
              </span>
              <span className="col-actions">
                <Link to={`/note/${note._id}`} className="btn btn-sm btn-primary">
                  View
                </Link>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => deleteNote(note._id)}
                >
                  Delete
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}