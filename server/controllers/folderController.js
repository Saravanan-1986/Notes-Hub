const Folder = require('../models/Folder');
const Note = require('../models/Note');
const User = require('../models/User');
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

    // Check ownership
    if (folder.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this folder' });
    }

    // Get all notes in this folder
    const notes = await Note.find({ folderId: id });

    // Get user for GitHub operations
    const user = await User.findById(req.user.id);
    const github = new GitHubService(user.githubToken, user.githubUsername);

    // Delete each note from GitHub
    for (const note of notes) {
      try {
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
        await github.deleteFile(note.githubPath, fileData.sha);
      } catch (ghErr) {
        // Skip if file already doesn't exist on GitHub
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