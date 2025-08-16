const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const Dataset = require('../models/Dataset');

const router = express.Router();

// Use memory storage; we don't persist dataset files to disk
const upload = multer({ storage: multer.memoryStorage() });

// Upload dataset and store rows in Mongo
router.post('/', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file is required' });

    // Read workbook from memory buffer
    const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json = xlsx.utils.sheet_to_json(sheet, { defval: '' });
    const headers = Object.keys(json[0] || {});

    const doc = await Dataset.create({
      name: req.file.originalname,
      sourceFile: { storage: 'gridfs', key: null, url: null, size: req.file.size },
      headers,
      rowCount: json.length,
      rows: json.map((row) => ({ data: row })),
    });

    res.status(201).json({ _id: doc._id, headers: doc.headers, rowCount: doc.rowCount });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const doc = await Dataset.findById(req.params.id).lean();
    if (!doc) return res.sendStatus(404);
    const sampleRows = (doc.rows || []).slice(0, 5).map((r) => r.data);
    res.json({ _id: doc._id, name: doc.name, headers: doc.headers, rowCount: doc.rowCount, sampleRows });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await Dataset.findByIdAndDelete(req.params.id);
    if (!doc) return res.sendStatus(404);
    if (doc.sourceFile?.key) {
      const abs = path.join(process.cwd(), doc.sourceFile.key);
      fs.existsSync(abs) && fs.unlinkSync(abs);
    }
    res.sendStatus(204);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

