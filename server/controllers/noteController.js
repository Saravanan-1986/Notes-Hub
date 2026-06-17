const Note = require('../models/Note');
const Folder = require('../models/Folder');
const User = require('../models/User');
const { encrypt, decrypt } = require('../utils/encryption');
const GitHubService = require('../utils/github');

// Upload PDF
exports.uploadNote = async (req, res) => {
  try {
    const { folderId, visibility } = req.body;
    
    // Check file exists
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    // Get folder
    const folder = await Folder.findById(folderId);
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    // Check ownership
    if (folder.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized for this folder' });
    }

    // Get user for GitHub token
    const user = await User.findById(req.user.id);
    if (!user.githubToken) {
      return res.status(400).json({ error: 'GitHub token not configured' });
    }

    // Encrypt PDF buffer
    const encryptedBase64 = encrypt(req.file.buffer);

    // GitHub path: folderName/filename.pdf.enc
    const githubPath = `${folder.name}/${req.file.originalname}.enc`;

    // Upload to GitHub
    const github = new GitHubService(user.githubToken, user.githubUsername);
    await github.createRepo();
    await github.uploadFile(githubPath, encryptedBase64);

    // Save metadata to MongoDB
    const note = new Note({
      filename: req.file.originalname,
      folderId,
      owner: req.user.id,
      visibility: visibility || 'private',
      githubPath,
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
        githubPath: note.githubPath,
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

    // Check access
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

    // Fetch from GitHub and decrypt
    const user = await User.findById(note.owner);
    if (!user || !user.githubToken) {
      return res.status(500).json({ error: 'Owner GitHub token unavailable' });
    }

    const github = new GitHubService(user.githubToken, user.githubUsername);
    const encryptedBase64 = await github.getFile(note.githubPath);
    const pdfBuffer = decrypt(encryptedBase64);

    // Send the decrypted PDF
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
      // If no query, return all public notes
      const notes = await Note.find({ visibility: 'public' })
        .populate('folderId', 'name')
        .populate('owner', 'name githubUsername')
        .sort({ uploadedAt: -1 });

      return res.json({
        success: true,
        count: notes.length,
        notes
      });
    }

    // Search by filename or folder name (case-insensitive)
    const regex = new RegExp(q, 'i');
    
    // First find matching folders
    const matchingFolders = await Folder.find({ 
      name: regex, 
      visibility: 'public' 
    }).select('_id');
    const folderIds = matchingFolders.map(f => f._id);

    // Find notes that are public AND (match filename OR belong to matching folders)
    const notes = await Note.find({
      visibility: 'public',
      $or: [
        { filename: regex },
        { folderId: { $in: folderIds } }
      ]
    })
      .populate('folderId', 'name')
      .populate('owner', 'name githubUsername')
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

    // Check ownership
    if (note.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this note' });
    }

    // Get user and delete from GitHub
    const user = await User.findById(req.user.id);
    const github = new GitHubService(user.githubToken, user.githubUsername);

    try {
      // Get the file SHA from GitHub content API
      const repoName = `${user.githubUsername}-notes`;
      const axios = require('axios');
      const headers = {
        Authorization: `token ${user.githubToken}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Notes-Hub'
      };
      const { data: fileData } = await axios.get(
        `https://api.github.com/repos/${user.githubUsername}/${repoName}/contents/${note.githubPath}`,
        { headers }
      );
      
      // Delete using SHA
      await github.deleteFile(note.githubPath, fileData.sha);
    } catch (ghErr) {
      // If file doesn't exist on GitHub (404), just delete from DB
      if (ghErr.response?.status !== 404) {
        console.error('GitHub delete error:', ghErr.message);
      }
    }

    // Delete from MongoDB
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
      .populate('owner', 'name githubUsername');
    
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Check access
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