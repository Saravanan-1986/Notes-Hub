const express = require('express');
const router = express.Router();
const multer = require('multer');
const auth = require('../middleware/auth');
const { 
  uploadNote, 
  getNotesByFolder, 
  viewNote, 
  searchPublicNotes, 
  deleteNote, 
  getNoteMetadata 
} = require('../controllers/noteController');

// Multer config - accept all file types
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max to support larger files
});

// Public routes (no auth required) - MUST be before param routes
router.get('/public/search', searchPublicNotes);

// Protected routes
router.post('/upload', auth, upload.single('pdf'), uploadNote);
router.get('/folder/:folderId', auth, getNotesByFolder);
router.get('/:id/metadata', auth, getNoteMetadata);
router.get('/:id/view', auth, viewNote);
router.delete('/:id', auth, deleteNote);

module.exports = router;