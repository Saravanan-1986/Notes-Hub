import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import API from '../api/axios';
import UniversalFileViewer from '../components/UniversalFileViewer';
import BackButton from '../components/BackButton';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function GroupDetailPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [folders, setFolders] = useState([]);
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('folders');
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showUpload, setShowUpload] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [viewingNote, setViewingNote] = useState(null);
  const [noteFileUrl, setNoteFileUrl] = useState(null);
  const [noteLoading, setNoteLoading] = useState(false);
  const [permissionLoading, setPermissionLoading] = useState({});

  const fetchGroupData = async () => {
    try {
      const { data } = await API.get(`/groups/${groupId}`);
      setGroup(data.group);
    } catch (err) {
      setError('Failed to load group');
    }
  };

  const fetchFolders = async () => {
    try {
      setLoading(true);
      // Fetch folders
      const foldersRes = await API.get(`/groups/${groupId}/folders`);
      const fetchedFolders = foldersRes.data.folders;
      setFolders(fetchedFolders);

      // Fetch all notes in ONE batch request (N+1 fix)
      try {
        const notesRes = await API.get(`/groups/${groupId}/all-notes`);
        setNotes(notesRes.data.notesByFolder || {});
      } catch (e) {
        // Fallback: fetch per folder
        const notesData = {};
        for (const folder of fetchedFolders) {
          try {
            const notesRes = await API.get(`/groups/${groupId}/folders/${folder._id}/notes`);
            notesData[folder._id] = notesRes.data.notes;
          } catch (err) {
            notesData[folder._id] = [];
          }
        }
        setNotes(notesData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroupData();
    fetchFolders();
  }, [groupId]);

  const createFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      await API.post(`/groups/${groupId}/folders`, { name: newFolderName });
      setNewFolderName('');
      setShowCreateFolder(false);
      setSuccessMsg('Folder created successfully');
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchFolders();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create folder');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleDeleteFolder = async (folderId) => {
    if (!window.confirm('Delete this folder and all its notes? This cannot be undone.')) return;
    try {
      await API.delete(`/groups/${groupId}/folders/${folderId}`);
      fetchFolders();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete folder');
    }
  };

  const handleUpload = async (e, folderId) => {
    e.preventDefault();
    if (!selectedFile) return;
    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', selectedFile); // Must match multer field name 'file'

    try {
      await API.post(`/groups/${groupId}/folders/${folderId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setSelectedFile(null);
      setShowUpload(null);
      setSuccessMsg('Note uploaded successfully');
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchFolders();
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Upload failed';
      setError(msg);
      setTimeout(() => setError(''), 4000);
    } finally {
      setUploading(false);
    }
  };

  const handleViewNote = async (note) => {
    setViewingNote({ id: note._id, filename: note.filename, fileType: note.fileType, mimeType: note.mimeType });
    setNoteLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/groups/${groupId}/notes/${note._id}/view`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        const errText = await response.text().catch(() => 'Unknown error');
        throw new Error(errText || `HTTP ${response.status}`);
      }
      const blob = await response.blob();
      if (blob.size === 0) throw new Error('Empty response from server');
      const url = URL.createObjectURL(blob);
      setNoteFileUrl(url);
    } catch (err) {
      setError('Failed to load note: ' + (err.message || 'Unknown error'));
      setViewingNote(null);
      setNoteFileUrl(null);
    } finally {
      setNoteLoading(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!window.confirm('Delete this note permanently?')) return;
    try {
      await API.delete(`/groups/${groupId}/notes/${noteId}`);
      fetchFolders();
      if (viewingNote && viewingNote.id === noteId) {
        setViewingNote(null);
        setNoteFileUrl(null);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete note');
    }
  };

  const handleAssignUpload = async (userId) => {
    setPermissionLoading(prev => ({ ...prev, [userId]: 'assign' }));
    try {
      await API.post(`/groups/${groupId}/assign-upload`, { userId });
      await fetchGroupData();
      setSuccessMsg('Upload permission granted');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to assign permission');
    } finally {
      setPermissionLoading(prev => ({ ...prev, [userId]: null }));
    }
  };

  const handleRevokeUpload = async (userId) => {
    setPermissionLoading(prev => ({ ...prev, [userId]: 'revoke' }));
    try {
      await API.post(`/groups/${groupId}/revoke-upload`, { userId });
      await fetchGroupData();
      setSuccessMsg('Upload permission revoked');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to revoke permission');
    } finally {
      setPermissionLoading(prev => ({ ...prev, [userId]: null }));
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!window.confirm('Remove this member from the group?')) return;
    try {
      await API.post(`/groups/${groupId}/remove-member`, { userId });
      await fetchGroupData();
      setSuccessMsg('Member removed');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove member');
    }
  };

  const handleDeleteGroup = async () => {
    if (!window.confirm('Delete this group permanently? All notes will be lost!')) return;
    try {
      await API.delete(`/groups/${groupId}`);
      navigate('/groups');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete group');
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (note) => {
    const fileType = note.fileType || '';
    switch (fileType) {
      case 'docx': return '📝';
      case 'image': return '🖼️';
      case 'video': return '🎬';
      case 'audio': return '🎵';
      case 'archive': return '🗜️';
      case 'spreadsheet': return '📊';
      case 'presentation': return '📽️';
      case 'text': return '📃';
      case 'code': return '💻';
      case 'pdf':
      default: return '📄';
    }
  };

  if (loading) return (
    <div className="page-container">
      <div className="loading-skeleton">
        <div className="skeleton-header" />
        <div className="skeleton-row" />
        <div className="skeleton-row" />
        <div className="skeleton-row" />
      </div>
    </div>
  );

  if (!group) return (
    <div className="page-container">
      <div className="loading error">{error || 'Group not found'}</div>
    </div>
  );

  return (
    <div className="page-container">
      <BackButton to="/groups" label="All Groups" />
      <div className="breadcrumb">
        <Link to="/groups">Groups</Link>
        <span className="breadcrumb-sep">→</span>
        <span>{group.name}</span>
      </div>

      {(error || successMsg) && (
        <div className={`alert ${error ? 'alert-error' : 'alert-success'}`}>
          <span className="alert-icon">{error ? '⚠️' : '✓'}</span>
          {error || successMsg}
        </div>
      )}

      {/* Group Info Header */}
      <div className="group-hero">
        <div className="group-hero-glow" />
        <div className="group-hero-content">
          <div className="group-hero-left">
            <div className="group-hero-badge">
              {group.isAdmin ? '👑 Admin' : '👤 Member'}
            </div>
            <h1 className="group-hero-title">{group.name}</h1>
            <div className="group-hero-stats">
              <div className="stat-item">
                <span className="stat-value">{group.memberCount}</span>
                <span className="stat-label">Members</span>
              </div>
              <div className="stat-divider" />
              <div className="stat-item">
                <span className="stat-value">{group.folderCount || 0}</span>
                <span className="stat-label">Folders</span>
              </div>
              <div className="stat-divider" />
              <div className="stat-item">
                <span className="stat-value">{group.noteCount || 0}</span>
                <span className="stat-label">Notes</span>
              </div>
            </div>
            <div className="group-hero-code">
              <span className="code-label">Invite Code</span>
              <span className="code-value">{group.code}</span>
              <button
                className="code-copy-btn"
                onClick={() => {
                  navigator.clipboard.writeText(group.code);
                  setSuccessMsg('Code copied!');
                  setTimeout(() => setSuccessMsg(''), 2000);
                }}
                title="Copy code"
              >
                📋
              </button>
            </div>
          </div>
          <div className="group-hero-right">
            {group.isAdmin && (
              <button className="btn btn-danger btn-glow" onClick={handleDeleteGroup}>
                <span className="btn-icon">🗑</span>
                Delete Group
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="neo-tabs">
        <button
          className={`neo-tab ${activeTab === 'folders' ? 'active' : ''}`}
          onClick={() => setActiveTab('folders')}
        >
          <span className="tab-icon">📁</span>
          <span>Folders & Notes</span>
          {activeTab === 'folders' && <span className="tab-indicator" />}
        </button>
        <button
          className={`neo-tab ${activeTab === 'members' ? 'active' : ''}`}
          onClick={() => setActiveTab('members')}
        >
          <span className="tab-icon">👥</span>
          <span>Members</span>
          {group.isAdmin && <span className="tab-badge">{group.memberCount}</span>}
          {activeTab === 'members' && <span className="tab-indicator" />}
        </button>
      </div>

      {/* Folders Tab */}
      {activeTab === 'folders' && (
        <div className="folders-section">
          <div className="section-header">
            <h2 className="section-title">📁 Folders</h2>
            {group.canUpload && (
              <button
                className="btn btn-primary btn-pulse"
                onClick={() => setShowCreateFolder(true)}
              >
                <span className="btn-icon">+</span>
                New Folder
              </button>
            )}
          </div>

          {showCreateFolder && (
            <div className="modal-overlay" onClick={() => setShowCreateFolder(false)}>
              <div className="modal-content neo-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-glow" />
                <h2>✨ Create New Folder</h2>
                <form onSubmit={createFolder}>
                  <div className="form-group">
                    <label>Folder Name</label>
                    <input
                      type="text"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      required
                      placeholder="e.g. Chapter 1 Notes"
                      autoFocus
                    />
                  </div>
                  <div className="modal-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowCreateFolder(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">Create</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {folders.length === 0 ? (
            <div className="empty-state neo-empty">
              <div className="empty-glow" />
              <div className="empty-icon">📁</div>
              <h3>No folders yet</h3>
              <p>Create a folder to organize notes in this group</p>
              {group.canUpload && (
                <button className="btn btn-primary" onClick={() => setShowCreateFolder(true)}>
                  Create Folder
                </button>
              )}
            </div>
          ) : (
            <div className="folders-grid">
              {folders.map((folder) => (
                <div key={folder._id} className="neo-card folder-card-expanded">
                  <div className="folder-card-glow" />
                  <div className="card-header">
                    <div className="card-header-left">
                      <div className="folder-icon-wrapper">
                        <span className="folder-icon">📁</span>
                      </div>
                      <div>
                        <h3 className="card-title">{folder.name}</h3>
                        <p className="card-subtitle">
                          by {folder.createdBy?.name} · {folder.noteCount || 0} note{(folder.noteCount || 0) !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="card-header-actions">
                      {group.canUpload && (
                        <button
                          className="btn btn-sm btn-accent btn-glow-sm"
                          onClick={() => setShowUpload(showUpload === folder._id ? null : folder._id)}
                        >
                          + Upload
                        </button>
                      )}
                      {group.canUpload && (
                        <button
                          className="btn btn-sm btn-danger btn-glow-sm"
                          onClick={() => handleDeleteFolder(folder._id)}
                          title="Delete folder"
                        >
                          🗑
                        </button>
                      )}
                    </div>
                  </div>

                  {showUpload === folder._id && (
                    <form onSubmit={(e) => handleUpload(e, folder._id)} className="upload-form">
                      <div className="file-drop-zone futuristic-drop">
                        <input
                          type="file"
                          onChange={(e) => setSelectedFile(e.target.files[0])}
                          required
                        />
                        <div className="drop-content">
                          <span className="drop-icon">📄</span>
                          <p className="drop-text">
                            {selectedFile ? (
                              <><strong>{selectedFile.name}</strong> <span className="file-size-badge">{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</span></>
                            ) : (
                              <><strong>Click</strong> to select any file</>
                            )}
                          </p>
                          <span className="drop-hint">Supports all file types</span>
                        </div>
                      </div>
                      <div className="upload-actions">
                        <button type="submit" className="btn btn-sm btn-primary" disabled={uploading || !selectedFile}>
                          {uploading ? (
                            <><span className="btn-spinner-sm" /> Uploading...</>
                          ) : (
                            '⬆ Upload'
                          )}
                        </button>
                        <button type="button" className="btn btn-sm btn-secondary" onClick={() => { setShowUpload(null); setSelectedFile(null); }}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}

                  {(notes[folder._id] || []).length > 0 ? (
                    <div className="notes-grid">
                      {(notes[folder._id] || []).map((note) => (
                        <div key={note._id} className="note-item">
                          <div className="note-item-icon">{getFileIcon(note)}</div>
                          <div className="note-item-info">
                            <span className="note-item-name">{note.filename}</span>
                            <div className="note-item-meta">
                              <span className="note-item-size">{formatSize(note.fileSize)}</span>
                              <span className="note-item-meta-sep">·</span>
                              <span className="note-item-author">{note.uploadedBy?.name}</span>
                              {note.fileType === 'docx' && (
                                <span className="note-item-badge word-badge">DOCX</span>
                              )}
                              {note.isEncrypted === false && (
                                <span className="note-item-badge image-badge">Direct</span>
                              )}
                            </div>
                          </div>
                          <div className="note-item-actions">
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => handleViewNote(note)}
                            >
                              View
                            </button>
                            {group.canUpload && (
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => handleDeleteNote(note._id)}
                              >
                                🗑
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="notes-empty">
                      <span className="notes-empty-icon">📄</span>
                      <span>No notes in this folder yet</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Members Tab */}
      {activeTab === 'members' && (
        <div className="members-section">
          <div className="section-header">
            <h2 className="section-title">👥 Members ({group.memberCount})</h2>
          </div>

          <div className="members-list">
            <div className="member-card admin-card">
              <div className="member-card-glow" />
              <div className="member-avatar-wrapper">
                <div className="member-avatar admin-avatar">
                  {group.admin?.name?.charAt(0) || '?'}
                </div>
                <div className="member-avatar-ring" />
              </div>
              <div className="member-info">
                <div className="member-name-row">
                  <span className="member-name">{group.admin?.name}</span>
                  <span className="member-role admin-role">👑 Admin</span>
                </div>
                <span className="member-access">✅ Full Access</span>
              </div>
              <div className="member-status">
                <div className="status-dot active" />
                <span>Online</span>
              </div>
            </div>

            {group.members?.filter(m => m.user?._id !== group.admin?._id).map((member) => (
              <div key={member.user?._id} className="member-card">
                <div className="member-card-glow" />
                <div className="member-avatar-wrapper">
                  <div className={`member-avatar ${member.canUpload ? 'upload-avatar' : ''}`}>
                    {member.user?.name?.charAt(0) || '?'}
                  </div>
                </div>
                <div className="member-info">
                  <div className="member-name-row">
                    <span className="member-name">{member.user?.name}</span>
                    <span className="member-role">Member</span>
                    {member.canUpload && <span className="upload-star">⭐</span>}
                  </div>
                  <span className={`member-access ${member.canUpload ? 'can-upload' : 'no-upload'}`}>
                    {member.canUpload ? '✅ Can Upload' : '❌ No Upload'}
                  </span>
                </div>
                <div className="member-actions">
                  {group.isAdmin && (
                    <>
                      {!member.canUpload ? (
                        <button
                          className="btn btn-sm btn-accent btn-glow-sm"
                          onClick={() => handleAssignUpload(member.user?._id)}
                          disabled={permissionLoading[member.user?._id] === 'assign' || permissionLoading[member.user?._id] === 'revoke'}
                        >
                          {permissionLoading[member.user?._id] === 'assign' ? (
                            <span className="btn-spinner-sm" />
                          ) : (
                            '⭐ Upload'
                          )}
                        </button>
                      ) : (
                        <button
                          className="btn btn-sm btn-warning"
                          onClick={() => handleRevokeUpload(member.user?._id)}
                          disabled={permissionLoading[member.user?._id] === 'assign' || permissionLoading[member.user?._id] === 'revoke'}
                        >
                          {permissionLoading[member.user?._id] === 'revoke' ? (
                            <span className="btn-spinner-sm" />
                          ) : (
                            '🚫 Revoke'
                          )}
                        </button>
                      )}
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleRemoveMember(member.user?._id)}
                      >
                        Remove
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Note Viewer Modal - Universal File Viewer */}
      {viewingNote && (
        <div className="modal-overlay" onClick={() => { 
          if (noteFileUrl) URL.revokeObjectURL(noteFileUrl);
          setViewingNote(null); 
          setNoteFileUrl(null); 
        }}>
          <div className="modal-content neo-modal viewer-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-glow" />
            <div className="viewer-modal-header">
              <h2>📁 {viewingNote.filename}</h2>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => { 
                  if (noteFileUrl) URL.revokeObjectURL(noteFileUrl);
                  setViewingNote(null); 
                  setNoteFileUrl(null); 
                }}
              >
                ✕ Close
              </button>
            </div>
            {noteLoading ? (
              <div className="loading" style={{ minHeight: '200px' }}>
                <div className="loading-spinner" />
                <span>Loading file...</span>
              </div>
            ) : noteFileUrl ? (
              <div className="viewer-container">
                <UniversalFileViewer 
                  fileUrl={noteFileUrl} 
                  filename={viewingNote.filename} 
                  fileType={viewingNote.fileType}
                  mimeType={viewingNote.mimeType}
                />
              </div>
            ) : (
              <div className="loading error" style={{ minHeight: '200px' }}>
                Error loading file
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
