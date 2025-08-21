const express = require('express');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const Template = require('../models/Template');
const Dataset = require('../models/Dataset');
const { renderOne } = require('../utils/render');
const { uploadBuffer } = require('../utils/gridfs'); // Add GridFS upload

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

// Batch: dataset -> single PDF output (NOW USING GRIDFS)
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

    // Create PDF in memory instead of writing to disk
    const doc = new PDFDocument({ autoFirstPage: false });
    const chunks = [];

    // Collect PDF data in memory
    doc.on('data', (chunk) => chunks.push(chunk));
    
    // Process all rows
    for (let i = start; i < end; i++) {
      const record = rows[i].data;
      const { buffer, width, height } = await renderOne({ template, record });
      doc.addPage({ size: [width, height] });
      doc.image(buffer, 0, 0, { width, height });
    }

    doc.end();

    // Wait for PDF generation to complete, then upload to GridFS
    doc.on('end', async () => {
      try {
        const pdfBuffer = Buffer.concat(chunks);
        
        // Upload PDF to GridFS 'outputs' bucket
        const fileId = await uploadBuffer({
          buffer: pdfBuffer,
          filename: fileName,
          contentType: 'application/pdf',
          bucketName: 'outputs'
        });

        // Return GridFS file URL instead of local file URL
        const pdfUrl = `/files/outputs/${fileId}`;
        res.json({ pdfUrl, count: end - start, fileId });
      } catch (uploadErr) {
        next(uploadErr);
      }
    });

    doc.on('error', next);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

