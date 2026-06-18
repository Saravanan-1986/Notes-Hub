const Group = require('../models/Group');
const GroupFolder = require('../models/GroupFolder');
const GroupNote = require('../models/GroupNote');
const GitHubService = require('../utils/github');
const path = require('path');

// Helper: Get the actual user ID string regardless of populated state
function getUserId(userField) {
  if (!userField) return null;
  return userField._id ? userField._id.toString() : userField.toString();
}

// Helper: Check if user is admin of a group
function isAdmin(group, userId) {
  return getUserId(group.admin) === userId;
}

// Helper: Check if user is a member of a group
function isMember(group, userId) {
  return group.members.some(m => getUserId(m.user) === userId);
}

// Helper: Check if user can upload in a group
function canUpload(group, userId) {
  if (isAdmin(group, userId)) return true;
  const member = group.members.find(m => getUserId(m.user) === userId);
  return member && member.canUpload;
}

// Helper: Get member info with populated user data
async function getPopulatedMembers(group) {
  await group.populate('members.user', 'name email');
  await group.populate('admin', 'name email');
  return group;
}

// Helper: Get MIME type from file extension
function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.mp3': 'audio/mpeg',
    '.zip': 'application/zip',
    '.rar': 'application/vnd.rar',
    '.7z': 'application/x-7z-compressed',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.md': 'text/markdown',
    '.py': 'text/x-python',
    '.jsx': 'text/javascript',
    '.ts': 'application/typescript',
    '.tsx': 'text/typescript',
    '.epub': 'application/epub+zip',
    '.mobi': 'application/x-mobipocket-ebook',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

// ============================================================
// CREATE GROUP
// ============================================================
exports.createGroup = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    const code = await Group.generateCode();

    // Create a GitHub repo for the group
    let repoName;
    try {
      repoName = await GitHubService.getOrCreateRepo(`group-${code}`);
    } catch (ghErr) {
      console.error('GitHub repo creation warning:', ghErr.message);
    }

    const group = new Group({
      name: name.trim(),
      code,
      admin: req.user.id,
      members: [{ user: req.user.id, canUpload: true }],
      repoName: repoName || ''
    });

    await group.save();
    await getPopulatedMembers(group);

    res.status(201).json({
      success: true,
      group: {
        _id: group._id,
        name: group.name,
        code: group.code,
        admin: group.admin,
        members: group.members,
        memberCount: group.members.length,
        repoName: group.repoName,
        createdAt: group.createdAt
      }
    });
  } catch (err) {
    console.error('Create group error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// GET USER'S GROUPS
// ============================================================
exports.getMyGroups = async (req, res) => {
  try {
    const groups = await Group.find({
      $or: [
        { admin: req.user.id },
        { 'members.user': req.user.id }
      ]
    })
      .populate('admin', 'name email')
      .populate('members.user', 'name email')
      .sort({ createdAt: -1 });

    const result = groups.map(group => ({
      _id: group._id,
      name: group.name,
      code: group.code,
      admin: group.admin,
      members: group.members,
      memberCount: group.members.length,
      isAdmin: isAdmin(group, req.user.id),
      canUpload: canUpload(group, req.user.id),
      createdAt: group.createdAt
    }));

    res.json({
      success: true,
      count: result.length,
      groups: result
    });
  } catch (err) {
    console.error('Get my groups error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// SEARCH GROUP BY CODE
// ============================================================
exports.searchGroupByCode = async (req, res) => {
  try {
    const { code } = req.query;

    if (!code || !code.trim()) {
      return res.status(400).json({ error: 'Group code is required' });
    }

    const group = await Group.findOne({ code: code.trim().toUpperCase() })
      .populate('admin', 'name email');

    if (!group) {
      return res.json({
        success: true,
        found: false,
        message: 'No group found with this code'
      });
    }

    // Check if user is already a member
    const alreadyMember = isMember(group, req.user.id);

    res.json({
      success: true,
      found: true,
      alreadyMember,
      group: {
        _id: group._id,
        name: group.name,
        code: group.code,
        admin: group.admin,
        memberCount: group.members.length,
        createdAt: group.createdAt
      }
    });
  } catch (err) {
    console.error('Search group error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// JOIN GROUP BY CODE
// ============================================================
exports.joinGroup = async (req, res) => {
  try {
    const { code } = req.body;

    if (!code || !code.trim()) {
      return res.status(400).json({ error: 'Group code is required' });
    }

    const group = await Group.findOne({ code: code.trim().toUpperCase() });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (isMember(group, req.user.id)) {
      return res.status(400).json({ error: 'You are already a member of this group' });
    }

    group.members.push({ user: req.user.id, canUpload: false });
    await group.save();
    await getPopulatedMembers(group);

    res.json({
      success: true,
      message: `You have joined "${group.name}"`,
      group: {
        _id: group._id,
        name: group.name,
        code: group.code,
        admin: group.admin,
        members: group.members,
        memberCount: group.members.length,
        isAdmin: false,
        canUpload: false,
        createdAt: group.createdAt
      }
    });
  } catch (err) {
    console.error('Join group error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// LEAVE GROUP
// ============================================================
exports.leaveGroup = async (req, res) => {
  try {
    const { id } = req.params;

    const group = await Group.findById(id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (isAdmin(group, req.user.id)) {
      return res.status(400).json({ error: 'Admin cannot leave the group. Transfer admin or delete the group.' });
    }

    if (!isMember(group, req.user.id)) {
      return res.status(400).json({ error: 'You are not a member of this group' });
    }

    group.members = group.members.filter(m => getUserId(m.user) !== req.user.id);
    await group.save();

    res.json({
      success: true,
      message: 'You have left the group'
    });
  } catch (err) {
    console.error('Leave group error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// GET GROUP DETAILS (with members)
// ============================================================
exports.getGroupDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const group = await Group.findById(id)
      .populate('admin', 'name email')
      .populate('members.user', 'name email');

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (!isMember(group, req.user.id)) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }

    // Get folder count and note count
    const folderCount = await GroupFolder.countDocuments({ groupId: id });
    const noteCount = await GroupNote.countDocuments({ groupId: id });

    res.json({
      success: true,
      group: {
        _id: group._id,
        name: group.name,
        code: group.code,
        admin: group.admin,
        members: group.members,
        memberCount: group.members.length,
        isAdmin: isAdmin(group, req.user.id),
        canUpload: canUpload(group, req.user.id),
        folderCount,
        noteCount,
        createdAt: group.createdAt
      }
    });
  } catch (err) {
    console.error('Get group details error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// ASSIGN UPLOAD PERMISSION (Admin only)
// ============================================================
exports.assignUploadPermission = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const group = await Group.findById(id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (!isAdmin(group, req.user.id)) {
      return res.status(403).json({ error: 'Only the group admin can assign upload permissions' });
    }

    const member = group.members.find(m => getUserId(m.user) === userId);
    if (!member) {
      return res.status(404).json({ error: 'User is not a member of this group' });
    }

    member.canUpload = true;
    await group.save();
    await getPopulatedMembers(group);

    res.json({
      success: true,
      message: 'Upload permission assigned',
      members: group.members
    });
  } catch (err) {
    console.error('Assign upload error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// REVOKE UPLOAD PERMISSION (Admin only)
// ============================================================
exports.revokeUploadPermission = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const group = await Group.findById(id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (!isAdmin(group, req.user.id)) {
      return res.status(403).json({ error: 'Only the group admin can revoke upload permissions' });
    }

    const member = group.members.find(m => getUserId(m.user) === userId);
    if (!member) {
      return res.status(404).json({ error: 'User is not a member of this group' });
    }

    member.canUpload = false;
    await group.save();
    await getPopulatedMembers(group);

    res.json({
      success: true,
      message: 'Upload permission revoked',
      members: group.members
    });
  } catch (err) {
    console.error('Revoke upload error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// REMOVE MEMBER (Admin only)
// ============================================================
exports.removeMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const group = await Group.findById(id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (!isAdmin(group, req.user.id)) {
      return res.status(403).json({ error: 'Only the group admin can remove members' });
    }

    if (getUserId(group.admin) === userId) {
      return res.status(400).json({ error: 'Cannot remove the admin' });
    }

    group.members = group.members.filter(m => getUserId(m.user) !== userId);
    await group.save();
    await getPopulatedMembers(group);

    res.json({
      success: true,
      message: 'Member removed from group',
      members: group.members
    });
  } catch (err) {
    console.error('Remove member error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// DELETE GROUP (Admin only)
// ============================================================
exports.deleteGroup = async (req, res) => {
  try {
    const { id } = req.params;

    const group = await Group.findById(id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (!isAdmin(group, req.user.id)) {
      return res.status(403).json({ error: 'Only the group admin can delete the group' });
    }

    // Delete all group notes from GitHub
    const groupNotes = await GroupNote.find({ groupId: id });
    for (const note of groupNotes) {
      try {
        const sha = await GitHubService.getFileSha(note.repoName, note.githubPath);
        await GitHubService.deleteFile(note.repoName, note.githubPath, sha);
      } catch (ghErr) {
        if (ghErr.response?.status !== 404) {
          console.error(`GitHub delete error for ${note.filename}:`, ghErr.message);
        }
      }
    }

    // Delete all related data
    await GroupNote.deleteMany({ groupId: id });
    await GroupFolder.deleteMany({ groupId: id });
    await Group.findByIdAndDelete(id);

    res.json({
      success: true,
      message: `Group "${group.name}" deleted successfully`
    });
  } catch (err) {
    console.error('Delete group error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// GROUP FOLDERS
// ============================================================

// Create folder in group
exports.createGroupFolder = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    const group = await Group.findById(id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (!canUpload(group, req.user.id)) {
      return res.status(403).json({ error: 'You do not have permission to create folders in this group' });
    }

    const folder = new GroupFolder({
      name: name.trim(),
      groupId: id,
      createdBy: req.user.id
    });

    await folder.save();

    res.status(201).json({
      success: true,
      folder
    });
  } catch (err) {
    console.error('Create group folder error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// Get group folders
exports.getGroupFolders = async (req, res) => {
  try {
    const { id } = req.params;

    const group = await Group.findById(id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (!isMember(group, req.user.id)) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }

    const folders = await GroupFolder.find({ groupId: id })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    // Get note count for each folder
    const foldersWithCount = await Promise.all(
      folders.map(async (folder) => {
        const noteCount = await GroupNote.countDocuments({ groupFolderId: folder._id });
        return {
          ...folder.toObject(),
          noteCount
        };
      })
    );

    res.json({
      success: true,
      count: foldersWithCount.length,
      folders: foldersWithCount
    });
  } catch (err) {
    console.error('Get group folders error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// Delete group folder
exports.deleteGroupFolder = async (req, res) => {
  try {
    const { id, folderId } = req.params;

    const group = await Group.findById(id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (!canUpload(group, req.user.id)) {
      return res.status(403).json({ error: 'You do not have permission to delete folders' });
    }

    const folder = await GroupFolder.findById(folderId);
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    // Delete notes in folder from GitHub
    const notes = await GroupNote.find({ groupFolderId: folderId });
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

    await GroupNote.deleteMany({ groupFolderId: folderId });
    await GroupFolder.findByIdAndDelete(folderId);

    res.json({
      success: true,
      message: `Folder "${folder.name}" deleted successfully`
    });
  } catch (err) {
    console.error('Delete group folder error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// GROUP NOTES
// ============================================================

// Upload note to group folder - supports all file types, no encryption
exports.uploadGroupNote = async (req, res) => {
  try {
    const { id, folderId } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const group = await Group.findById(id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (!canUpload(group, req.user.id)) {
      return res.status(403).json({ error: 'You do not have permission to upload in this group' });
    }

    const folder = await GroupFolder.findById(folderId);
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found in this group' });
    }

    const originalName = req.file.originalname;
    const ext = path.extname(originalName).toLowerCase();
    
    // Determine file type category for display
    let fileType = 'pdf'; // default
    if (['.docx', '.doc'].includes(ext)) fileType = 'docx';
    else if (['.txt', '.md', '.csv'].includes(ext)) fileType = 'text';
    else if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp'].includes(ext)) fileType = 'image';
    else if (['.mp4', '.avi', '.mkv', '.mov'].includes(ext)) fileType = 'video';
    else if (['.mp3', '.wav', '.ogg', '.flac'].includes(ext)) fileType = 'audio';
    else if (['.zip', '.rar', '.7z', '.tar', '.gz'].includes(ext)) fileType = 'archive';
    else if (['.xlsx', '.xls'].includes(ext)) fileType = 'spreadsheet';
    else if (['.pptx', '.ppt'].includes(ext)) fileType = 'presentation';
    else if (['.html', '.css', '.js', '.json', '.xml', '.py', '.jsx', '.ts', '.tsx'].includes(ext)) fileType = 'code';

    // Store file directly without encryption
    const contentBase64 = req.file.buffer.toString('base64');
    const githubPath = `groups/${group.code}/${folder.name}/${originalName}`;

    console.log(`📁 Uploading ${originalName} (${(req.file.size / 1024).toFixed(1)} KB) - No encryption applied`);

    // Upload to GitHub using group's repo
    const repoName = group.repoName || `notes-hub-group-${group.code}`;
    let result;
    try {
      result = await GitHubService.uploadFileToRepo(repoName, githubPath, contentBase64);
    } catch (ghErr) {
      // If repo doesn't exist, create it and retry
      if (ghErr.response?.status === 404 || ghErr.response?.status === 422) {
        const newRepoName = await GitHubService.getOrCreateRepo(`group-${group.code}`);
        group.repoName = newRepoName;
        await group.save();
        result = await GitHubService.uploadFileToRepo(newRepoName, githubPath, contentBase64);
      } else {
        throw ghErr;
      }
    }

    // Detect MIME type for the file
    const mimeType = req.file.mimetype || getMimeType(originalName);

    const groupNote = new GroupNote({
      filename: originalName,
      originalName,
      fileType,
      mimeType,
      groupFolderId: folderId,
      groupId: id,
      uploadedBy: req.user.id,
      githubPath,
      repoName: group.repoName,
      fileSize: req.file.size,
      isEncrypted: false
    });

    await groupNote.save();

    res.status(201).json({
      success: true,
      note: {
        _id: groupNote._id,
        filename: groupNote.filename,
        fileType: groupNote.fileType,
        mimeType: groupNote.mimeType,
        isEncrypted: groupNote.isEncrypted,
        folder: folder.name,
        folderId: folder._id,
        uploadedBy: req.user.id,
        fileSize: groupNote.fileSize,
        uploadedAt: groupNote.uploadedAt
      }
    });
  } catch (err) {
    console.error('Upload group note error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// Get notes in a group folder
exports.getGroupNotes = async (req, res) => {
  try {
    const { id, folderId } = req.params;

    const group = await Group.findById(id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (!isMember(group, req.user.id)) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }

    const notes = await GroupNote.find({ groupFolderId: folderId })
      .populate('uploadedBy', 'name email')
      .sort({ uploadedAt: -1 });

    res.json({
      success: true,
      count: notes.length,
      notes
    });
  } catch (err) {
    console.error('Get group notes error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// View a group note - returns raw file content with proper MIME type
exports.viewGroupNote = async (req, res) => {
  try {
    const { id, noteId } = req.params;

    const group = await Group.findById(id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (!isMember(group, req.user.id)) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }

    const note = await GroupNote.findById(noteId);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Fetch from GitHub
    const fileContent = await GitHubService.getFile(note.repoName, note.githubPath);
    
    // Just decode base64 (no decryption needed)
    const fileBuffer = Buffer.from(fileContent, 'base64');

    // Determine MIME type
    const contentType = note.mimeType || getMimeType(note.filename);

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${note.filename}"`,
      'Content-Length': fileBuffer.length
    });
    res.send(fileBuffer);
  } catch (err) {
    console.error('View group note error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// Delete a group note
exports.deleteGroupNote = async (req, res) => {
  try {
    const { id, noteId } = req.params;

    const group = await Group.findById(id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (!canUpload(group, req.user.id)) {
      return res.status(403).json({ error: 'You do not have permission to delete notes' });
    }

    const note = await GroupNote.findById(noteId);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Delete from GitHub
    try {
      const sha = await GitHubService.getFileSha(note.repoName, note.githubPath);
      await GitHubService.deleteFile(note.repoName, note.githubPath, sha);
    } catch (ghErr) {
      if (ghErr.response?.status !== 404) {
        console.error('GitHub delete error:', ghErr.message);
      }
    }

    await GroupNote.findByIdAndDelete(noteId);

    res.json({
      success: true,
      message: 'Note deleted successfully'
    });
  } catch (err) {
    console.error('Delete group note error:', err.message);
    res.status(500).json({ error: err.message });
  }
};