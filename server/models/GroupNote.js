const mongoose = require('mongoose');

const groupNoteSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  originalName: { type: String },
  fileType: { type: String, default: 'pdf' },
  mimeType: { type: String },
  groupFolderId: { type: mongoose.Schema.Types.ObjectId, ref: 'GroupFolder', required: true },
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  githubPath: { type: String, required: true },
  repoName: { type: String, required: true },
  fileSize: { type: Number },
  isEncrypted: { type: Boolean, default: false },
  uploadedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('GroupNote', groupNoteSchema);