const express = require('express');
const router = express.Router();
const multer = require('multer');
const auth = require('../middleware/auth');
const {
  createGroup,
  getMyGroups,
  searchGroupByCode,
  joinGroup,
  leaveGroup,
  getGroupDetails,
  assignUploadPermission,
  revokeUploadPermission,
  removeMember,
  deleteGroup,
  createGroupFolder,
  getGroupFolders,
  deleteGroupFolder,
  uploadGroupNote,
  getGroupNotes,
  viewGroupNote,
  deleteGroupNote
} = require('../controllers/groupController');

// Multer config for group note uploads - accept all file types
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max to support larger files
});

// Group management
router.post('/', auth, createGroup);
router.get('/', auth, getMyGroups);
router.get('/search', auth, searchGroupByCode);
router.post('/join', auth, joinGroup);
router.get('/:id', auth, getGroupDetails);
router.post('/:id/leave', auth, leaveGroup);
router.delete('/:id', auth, deleteGroup);

// Member management (admin only)
router.post('/:id/assign-upload', auth, assignUploadPermission);
router.post('/:id/revoke-upload', auth, revokeUploadPermission);
router.post('/:id/remove-member', auth, removeMember);

// Group folders
router.post('/:id/folders', auth, createGroupFolder);
router.get('/:id/folders', auth, getGroupFolders);
router.delete('/:id/folders/:folderId', auth, deleteGroupFolder);

// Group notes
router.post('/:id/folders/:folderId/upload', auth, upload.single('file'), uploadGroupNote);
router.get('/:id/folders/:folderId/notes', auth, getGroupNotes);
router.get('/:id/notes/:noteId/view', auth, viewGroupNote);
router.delete('/:id/notes/:noteId', auth, deleteGroupNote);

// Batch get notes for all folders in a group (performance)
router.get('/:id/all-notes', auth, async (req, res) => {
  try {
    const Group = require('../models/Group');
    const GroupNote = require('../models/GroupNote');
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (!group.members.some(m => (m.user._id || m.user).toString() === req.user.id) && group.admin.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not a member' });
    }
    const notes = await GroupNote.find({ groupId: req.params.id })
      .populate('uploadedBy', 'name email')
      .sort({ uploadedAt: -1 });
    
    // Group by folderId
    const grouped = {};
    notes.forEach(note => {
      const fid = note.groupFolderId.toString();
      if (!grouped[fid]) grouped[fid] = [];
      grouped[fid].push(note);
    });
    
    res.json({ success: true, notesByFolder: grouped });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;