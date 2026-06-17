const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { createFolder, getFolders, deleteFolder } = require('../controllers/folderController');

router.post('/', auth, createFolder);
router.get('/', auth, getFolders);
router.delete('/:id', auth, deleteFolder);

module.exports = router;