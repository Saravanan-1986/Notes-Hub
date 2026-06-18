const mongoose = require('mongoose');

const groupFolderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('GroupFolder', groupFolderSchema);