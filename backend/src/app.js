require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const connectDB = require('./config/db');

const templatesRouter = require('./routes/templates');
const datasetsRouter = require('./routes/datasets');
const generateRouter = require('./routes/generate');
const filesRouter = require('./routes/files');

const app = express();

// Ensure upload directories exist for local storage
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
['', 'templates', 'datasets', 'previews', 'outputs'].forEach((sub) => {
  const dir = path.join(process.cwd(), UPLOAD_DIR, sub);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// DB
connectDB();

// Middleware
const allowedOrigins = [
  process.env.CLIENT_ORIGIN,
  'http://localhost:5173',
  'https://id-generator-mu.vercel.app'
];
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// Static files (legacy local uploads)
app.use('/uploads', express.static(path.join(process.cwd(), UPLOAD_DIR)));

// File streaming from GridFS
app.use('/files', filesRouter);

// Health
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Routes
app.use('/api/templates', templatesRouter);
app.use('/api/datasets', datasetsRouter);
app.use('/api/generate', generateRouter);

// Start
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

