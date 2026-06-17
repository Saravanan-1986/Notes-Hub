import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import API from '../api/axios';

export default function NoteViewer() {
  const { id } = useParams();
  const [note, setNote] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchNote = async () => {
      try {
        // Get metadata first
        const { data } = await API.get(`/notes/${id}/metadata`);
        setNote(data.note);

        // Get the PDF - backend will decrypt and return raw PDF
        const token = localStorage.getItem('token');
        const response = await fetch(`http://localhost:5000/api/notes/${id}/view`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch PDF');
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      } catch (err) {
        setError(err.message || 'Failed to load document');
      } finally {
        setLoading(false);
      }
    };

    fetchNote();

    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [id]);

  if (loading) return <div className="loading">Decrypting and loading document...</div>;
  if (error) return <div className="loading error">Error: {error}</div>;
  if (!note) return <div className="loading">Note not found</div>;

  return (
    <div className="page-container viewer-page">
      <div className="breadcrumb">
        <Link to="/dashboard">My Folders</Link>
        <span className="breadcrumb-sep">/</span>
        {note.folder && <><Link to={`/folder/${note.folderId}`}>{note.folder}</Link><span className="breadcrumb-sep">/</span></>}
        <span>{note.filename}</span>
      </div>

      <div className="viewer-info">
        <div className="viewer-info-left">
          <h1>{note.filename}</h1>
          <div className="viewer-meta">
            {note.folder && <span className="meta-item">📁 {note.folder}</span>}
            <span className="meta-item">👤 {note.owner?.name}</span>
            <span className={`badge ${note.visibility}`}>{note.visibility}</span>
            {note.fileSize && (
              <span className="meta-item">
                {(note.fileSize / 1024 / 1024).toFixed(1)} MB
              </span>
            )}
          </div>
        </div>
        <div className="viewer-info-right">
          <a
            href={pdfUrl}
            download={note.filename}
            className="btn btn-primary"
          >
            ⬇ Download PDF
          </a>
        </div>
      </div>

      <div className="pdf-viewer">
        {pdfUrl ? (
          <iframe
            src={pdfUrl}
            title={note.filename}
            className="pdf-iframe"
          />
        ) : (
          <div className="loading">Preparing document...</div>
        )}
      </div>
    </div>
  );
}