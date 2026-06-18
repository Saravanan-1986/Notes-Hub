const Note = require('../models/Note');
const Folder = require('../models/Folder');
const User = require('../models/User');
const GitHubService = require('../utils/github');
const path = require('path');

// Helper: Get MIME type from file extension
function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.mp3': 'audio/mpeg',
    '.zip': 'application/zip',
    '.rar': 'application/vnd.rar',
    '.7z': 'application/x-7z-compressed',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.md': 'text/markdown',
    '.py': 'text/x-python',
    '.jsx': 'text/javascript',
    '.ts': 'application/typescript',
    '.tsx': 'text/typescript',
    '.epub': 'application/epub+zip',
    '.mobi': 'application/x-mobipocket-ebook',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

function getFileType(filename, mimeType = '') {
  const ext = path.extname(filename).toLowerCase();
  if (mimeType.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp', '.ico'].includes(ext)) return 'image';
  if (mimeType.startsWith('video/') || ['.mp4', '.webm', '.ogg', '.avi', '.mov', '.mkv', '.wmv'].includes(ext)) return 'video';
  if (mimeType.startsWith('audio/') || ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.wma'].includes(ext)) return 'audio';
  if (ext === '.pdf') return 'pdf';
  if (['.docx', '.doc'].includes(ext)) return 'docx';
  if (['.xlsx', '.xls', '.csv'].includes(ext)) return 'spreadsheet';
  if (['.pptx', '.ppt'].includes(ext)) return 'presentation';
  if (['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2'].includes(ext)) return 'archive';
  if (mimeType.startsWith('text/') || ['.txt', '.md', '.log', '.ini', '.cfg'].includes(ext)) return 'text';
  if (['.js', '.jsx', '.ts', '.tsx', '.py', '.rb', '.java', '.c', '.cpp', '.h', '.cs', '.go', '.rs', '.swift', '.kt', '.php', '.html', '.css', '.scss', '.less', '.json', '.xml', '.yaml', '.yml', '.toml', '.sh', '.bash', '.sql'].includes(ext)) return 'code';
  return 'file';
}

function safePathSegment(value) {
  return value.replace(/[\\/:*?"<>|#%{}^~[\]`]/g, '_').trim() || 'file';
}

// Upload file (any type)
exports.uploadNote = async (req, res) => {
  try {
    const { folderId, visibility } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const folder = await Folder.findById(folderId);
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    if (folder.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized for this folder' });
    }

    const originalName = req.file.originalname;
    const mimeType = req.file.mimetype || getMimeType(originalName);
    const fileType = getFileType(originalName, mimeType);
    
    // Store file directly without encryption - base64 encode it
    const contentBase64 = req.file.buffer.toString('base64');

    // GitHub path: folderName/filename
    const githubPath = `${safePathSegment(folder.name)}/${Date.now()}-${safePathSegment(originalName)}`;

    // Upload to GitHub using central credentials - auto-creates repo with overflow
    const result = await GitHubService.uploadFile(req.user.id, githubPath, contentBase64);

    // Save metadata to MongoDB including the repo where it was stored
    const note = new Note({
      filename: originalName,
      folderId,
      owner: req.user.id,
      visibility: visibility || 'private',
      githubPath,
      repoName: result.repoName,
      mimeType,
      fileType,
      fileSize: req.file.size
    });

    await note.save();

    res.status(201).json({
      success: true,
      note: {
        id: note._id,
        filename: note.filename,
        folder: folder.name,
        folderId: folder._id,
        visibility: note.visibility,
        fileSize: note.fileSize,
        mimeType: note.mimeType,
        fileType: note.fileType,
        uploadedAt: note.uploadedAt
      }
    });

  } catch (err) {
    console.error('Upload error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// Get all notes in a folder
exports.getNotesByFolder = async (req, res) => {
  try {
    const { folderId } = req.params;
    
    const folder = await Folder.findById(folderId);
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    if (folder.owner.toString() !== req.user.id && folder.visibility === 'private') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const notes = await Note.find({ folderId }).sort({ uploadedAt: -1 });
    
    res.json({
      success: true,
      count: notes.length,
      notes
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// View a single note - return raw file content with proper MIME type
exports.viewNote = async (req, res) => {
  try {
    const { id } = req.params;

    const note = await Note.findById(id).populate('folderId', 'name');
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Check access
    const folder = await Folder.findById(note.folderId);
    const isOwner = note.owner.toString() === req.user.id;
    const isPublic = note.visibility === 'public' || folder.visibility === 'public';

    if (!isOwner && !isPublic) {
      return res.status(403).json({ error: 'Not authorized to view this note' });
    }

    // Fetch raw bytes from GitHub. No decryption or conversion is applied.
    const fileBuffer = await GitHubService.getFileBuffer(note.repoName, note.githubPath);

    // Determine MIME type from filename
    const contentType = note.mimeType || getMimeType(note.filename);

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(note.filename)}`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Length': fileBuffer.length
    });
    res.send(fileBuffer);
  } catch (err) {
    console.error('View note error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// Search public notes
exports.searchPublicNotes = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      const notes = await Note.find({ visibility: 'public' })
        .populate('folderId', 'name')
        .populate('owner', 'name email')
        .sort({ uploadedAt: -1 });

      return res.json({
        success: true,
        count: notes.length,
        notes
      });
    }

    const regex = new RegExp(q, 'i');
    
    const matchingFolders = await Folder.find({ 
      name: regex, 
      visibility: 'public' 
    }).select('_id');
    const folderIds = matchingFolders.map(f => f._id);

    const notes = await Note.find({
      visibility: 'public',
      $or: [
        { filename: regex },
        { folderId: { $in: folderIds } }
      ]
    })
      .populate('folderId', 'name')
      .populate('owner', 'name email')
      .sort({ uploadedAt: -1 });

    res.json({
      success: true,
      count: notes.length,
      notes
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete a note
exports.deleteNote = async (req, res) => {
  try {
    const { id } = req.params;

    const note = await Note.findById(id);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    if (note.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this note' });
    }

    // Delete from GitHub using stored repo name
    try {
      const sha = await GitHubService.getFileSha(note.repoName, note.githubPath);
      await GitHubService.deleteFile(note.repoName, note.githubPath, sha);
    } catch (ghErr) {
      if (ghErr.response?.status !== 404) {
        console.error('GitHub delete error:', ghErr.message);
      }
    }

    await Note.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Note deleted successfully'
    });
  } catch (err) {
    console.error('Delete note error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// Get note metadata (without file content)
exports.getNoteMetadata = async (req, res) => {
  try {
    const { id } = req.params;

    const note = await Note.findById(id)
      .populate('folderId', 'name')
      .populate('owner', 'name email');
    
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const isOwner = note.owner._id.toString() === req.user.id;
    const isPublic = note.visibility === 'public';

    if (!isOwner && !isPublic) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json({
      success: true,
      note: {
        id: note._id,
        filename: note.filename,
        folder: note.folderId?.name || 'Unknown',
        folderId: note.folderId?._id,
        owner: note.owner,
        visibility: note.visibility,
        fileSize: note.fileSize,
        mimeType: note.mimeType,
        fileType: note.fileType,
        uploadedAt: note.uploadedAt
      }
    });
  } catch (err) {
    console.error('Get note metadata error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
