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
      setError('Please select a file');
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
        <h2>Upload File</h2>
        <form onSubmit={handleSubmit}>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-group">
            <label>Select File</label>
            <div className="file-drop-zone">
              <input
                type="file"
                onChange={(e) => setFile(e.target.files[0])}
                required
              />
              <span className="drop-icon">📄</span>
              <p className="drop-text">
                {file ? file.name : <><strong>Click to browse</strong> or drag any file here</>}
              </p>
            </div>
            {file && (
              <div className="file-selected">
                <span className="file-name">{file.name}</span>
                <span className="file-size">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
              </div>
            )}
          </div>
          <div className="form-group">
            <label>Visibility</label>
            <select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
              <option value="private">Private — only you can see this</option>
              <option value="public">Public — anyone can search & view</option>
            </select>
          </div>
          <div className="section-divider" />
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={uploading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={uploading || !file}>
              {uploading ? (
                <>Uploading...</>
              ) : (
                <>Upload</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
