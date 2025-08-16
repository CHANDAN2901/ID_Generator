const express = require('express');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const Template = require('../models/Template');
const Dataset = require('../models/Dataset');
const { renderOne } = require('../utils/render');

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';

const router = express.Router();
// Preview: generate single record image and stream back (no disk write)
router.post('/preview', async (req, res, next) => {
  try {
    const { templateId, record } = req.body;
    const template = await Template.findById(templateId).lean();
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const { buffer } = await renderOne({ template, record });
    const fileName = `preview-${Date.now()}.png`;
    // Store preview in GridFS (optional). For now just return a data URL path served by a short-lived route
    // Simpler: write to /uploads/previews as before but we aim to remove local writes in a later step
    // For immediate UX, we can inline as base64 data, but frontend expects a URL; keep local write for now? We'll switch to data URL:
    const b64 = `data:image/png;base64,${buffer.toString('base64')}`;
    res.json({ previewUrl: b64 });
  } catch (err) {
    next(err);
  }
});

// Batch: dataset -> single PDF output
router.post('/batch', async (req, res, next) => {
  try {
    const { templateId, datasetId, range } = req.body;
    const template = await Template.findById(templateId).lean();
    if (!template) return res.status(404).json({ error: 'Template not found' });
    const dataset = await Dataset.findById(datasetId).lean();
    if (!dataset) return res.status(404).json({ error: 'Dataset not found' });

    const rows = dataset.rows || [];
    const start = range?.start ?? 0;
    const end = Math.min(range?.end ?? rows.length, rows.length);

    const fileName = `batch-${Date.now()}.pdf`;
    const outPath = path.join(process.cwd(), UPLOAD_DIR, 'outputs', fileName);

    // Create PDF and write incrementally
    const doc = new PDFDocument({ autoFirstPage: false });
    const stream = fs.createWriteStream(outPath);
    doc.pipe(stream);

    for (let i = start; i < end; i++) {
      const record = rows[i].data;
      const { buffer, width, height } = await renderOne({ template, record });
      doc.addPage({ size: [width, height] });
      doc.image(buffer, 0, 0, { width, height });
    }

    doc.end();

    stream.on('finish', () => {
      const url = `/uploads/outputs/${fileName}`;
      res.json({ pdfUrl: url, count: end - start });
    });

    stream.on('error', (err) => next(err));
  } catch (err) {
    next(err);
  }
});

module.exports = router;

