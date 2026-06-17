const Folder = require('../models/Folder');
const Note = require('../models/Note');
const GitHubService = require('../utils/github');

// Create Folder
exports.createFolder = async (req, res) => {
  try {
    const { name, visibility } = req.body;

    const folder = new Folder({
      name,
      owner: req.user.id,
      visibility: visibility || 'private'
    });

    await folder.save();

    res.status(201).json({
      success: true,
      folder
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get All User Folders
exports.getFolders = async (req, res) => {
  try {
    const folders = await Folder.find({ owner: req.user.id }).sort({ createdAt: -1 });
    res.json({
      success: true,
      count: folders.length,
      folders
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete Folder (and all notes inside it)
exports.deleteFolder = async (req, res) => {
  try {
    const { id } = req.params;

    const folder = await Folder.findById(id);
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    if (folder.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this folder' });
    }

    // Get all notes in this folder
    const notes = await Note.find({ folderId: id });

    // Delete each note from GitHub
    for (const note of notes) {
      try {
        const sha = await GitHubService.getFileSha(note.repoName, note.githubPath);
        await GitHubService.deleteFile(note.repoName, note.githubPath, sha);
      } catch (ghErr) {
        if (ghErr.response?.status !== 404) {
          console.error(`GitHub delete error for ${note.filename}:`, ghErr.message);
        }
      }
    }

    // Delete all notes from MongoDB
    await Note.deleteMany({ folderId: id });

    // Delete the folder
    await Folder.findByIdAndDelete(id);

    res.json({
      success: true,
      message: `Folder "${folder.name}" and ${notes.length} note(s) deleted successfully`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};