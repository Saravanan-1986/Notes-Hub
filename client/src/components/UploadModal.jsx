import { useState } from 'react';
import API from '../api/axios';

export default function UploadModal({ folderId, onClose, onUpload }) {
  const [file, setFile] = useState(null);
  const [visibility, setVisibility] = useState('private');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a PDF file');
      return;
    }

    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('folderId', folderId);
    formData.append('visibility', visibility);

    try {
      await API.post('/notes/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      onUpload();
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Upload PDF Note</h2>
        <form onSubmit={handleSubmit}>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-group">
            <label>Select PDF File</label>
            <div className="file-input-wrapper">
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => setFile(e.target.files[0])}
                required
                className="file-input"
              />
              <div className="file-input-label">
                {file ? file.name : 'Click to select a PDF'}
              </div>
            </div>
            {file && (
              <small className="form-hint">
                {(file.size / 1024 / 1024).toFixed(1)} MB
              </small>
            )}
          </div>
          <div className="form-group">
            <label>Visibility</label>
            <select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
              <option value="private">Private (only you)</option>
              <option value="public">Public (searchable by everyone)</option>
            </select>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={uploading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={uploading || !file}>
              {uploading ? 'Encrypting & Uploading...' : 'Upload & Encrypt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}