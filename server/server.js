require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Connect Database
connectDB();

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/folders', require('./routes/folders'));
app.use('/api/notes', require('./routes/notes'));
app.use('/api/groups', require('./routes/groups'));

// Test Route
app.get('/', (req, res) => {
  res.send('Notes Hub API Running');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));