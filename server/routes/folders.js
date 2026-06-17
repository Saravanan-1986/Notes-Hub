const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { 
  createFolder, 
  getFolders, 
  deleteFolder, 
  searchPublicFolders,
  getPublicFolderNotes 
} = require('../controllers/folderController');

// Public routes (no auth)
router.get('/public/search', searchPublicFolders);
router.get('/public/:id/notes', getPublicFolderNotes);

// Protected routes
router.post('/', auth, createFolder);
router.get('/', auth, getFolders);
router.delete('/:id', auth, deleteFolder);

module.exports = router;