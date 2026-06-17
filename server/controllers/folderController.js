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

// Search Public Folders (no auth required)
exports.searchPublicFolders = async (req, res) => {
  try {
    const { q } = req.query;

    let folders;
    if (q) {
      const regex = new RegExp(q, 'i');
      folders = await Folder.find({ 
        name: regex, 
        visibility: 'public' 
      })
        .populate('owner', 'name email')
        .sort({ createdAt: -1 });
    } else {
      folders = await Folder.find({ visibility: 'public' })
        .populate('owner', 'name email')
        .sort({ createdAt: -1 });
    }

    // Get note count for each folder
    const foldersWithCount = await Promise.all(
      folders.map(async (folder) => {
        const noteCount = await Note.countDocuments({ 
          folderId: folder._id, 
          visibility: 'public' 
        });
        return {
          _id: folder._id,
          name: folder.name,
          owner: folder.owner,
          noteCount,
          createdAt: folder.createdAt
        };
      })
    );

    res.json({
      success: true,
      count: foldersWithCount.length,
      folders: foldersWithCount
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get public notes inside a public folder (no auth required)
exports.getPublicFolderNotes = async (req, res) => {
  try {
    const { id } = req.params;

    const folder = await Folder.findOne({ _id: id, visibility: 'public' });
    if (!folder) {
      return res.status(404).json({ error: 'Public folder not found' });
    }

    const notes = await Note.find({ 
      folderId: id, 
      visibility: 'public' 
    })
      .populate('owner', 'name email')
      .sort({ uploadedAt: -1 });

    res.json({
      success: true,
      folder: {
        _id: folder._id,
        name: folder.name,
        owner: folder.owner
      },
      count: notes.length,
      notes
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

    const notes = await Note.find({ folderId: id });

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

    await Note.deleteMany({ folderId: id });
    await Folder.findByIdAndDelete(id);

    res.json({
      success: true,
      message: `Folder "${folder.name}" and ${notes.length} note(s) deleted successfully`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};