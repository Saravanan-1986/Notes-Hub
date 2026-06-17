const Note = require('../models/Note');
const Folder = require('../models/Folder');
const User = require('../models/User');
const { encrypt, decrypt } = require('../utils/encryption');
const GitHubService = require('../utils/github');

// Upload PDF
exports.uploadNote = async (req, res) => {
  try {
    const { folderId, visibility } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const folder = await Folder.findById(folderId);
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    if (folder.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized for this folder' });
    }

    // Encrypt PDF buffer
    const encryptedBase64 = encrypt(req.file.buffer);

    // GitHub path: folderName/filename.pdf.enc
    const githubPath = `${folder.name}/${req.file.originalname}.enc`;

    // Upload to GitHub using central credentials - auto-creates repo with overflow
    const result = await GitHubService.uploadFile(req.user.id, githubPath, encryptedBase64);

    // Save metadata to MongoDB including the repo where it was stored
    const note = new Note({
      filename: req.file.originalname,
      folderId,
      owner: req.user.id,
      visibility: visibility || 'private',
      githubPath,
      repoName: result.repoName,
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

// View a single note - decrypt and return PDF
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

    // Fetch from GitHub using the stored repo name
    const encryptedBase64 = await GitHubService.getFile(note.repoName, note.githubPath);
    const pdfBuffer = decrypt(encryptedBase64);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${note.filename}"`,
      'Content-Length': pdfBuffer.length
    });
    res.send(pdfBuffer);
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

// Get note metadata (without PDF content)
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
        uploadedAt: note.uploadedAt
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};