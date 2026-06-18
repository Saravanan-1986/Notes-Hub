const mongoose = require('mongoose');

const groupMemberSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  canUpload: { type: Boolean, default: false },
  joinedAt: { type: Date, default: Date.now }
});

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, unique: true },
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [groupMemberSchema],
  repoName: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// Generate unique join code
groupSchema.statics.generateCode = async function() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  let exists = true;
  
  while (exists) {
    code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    exists = await this.findOne({ code });
  }
  
  return code;
};

module.exports = mongoose.model('Group', groupSchema);