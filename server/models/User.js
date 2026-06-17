const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  repos: [{ type: String }], // e.g. ["userid-notes-1", "userid-notes-2"]
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);