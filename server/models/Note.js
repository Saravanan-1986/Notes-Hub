const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  folderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  visibility: { type: String, enum: ['public', 'private'], default: 'private' },
  githubPath: { type: String, required: true },
  repoName: { type: String, required: true },
  fileSize: { type: Number },
  uploadedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Note', noteSchema);