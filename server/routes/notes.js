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

// Multer config - store in memory (we encrypt before saving)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files allowed'), false);
    }
  }
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