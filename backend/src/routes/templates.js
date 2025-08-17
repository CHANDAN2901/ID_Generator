const express = require('express');
const multer = require('multer');
const path = require('path');

const sharp = require('sharp');
const Template = require('../models/Template');
const { uploadBuffer } = require('../utils/gridfs');

const router = express.Router();

// Use in-memory storage and push to GridFS
const upload = multer({ storage: multer.memoryStorage() });

// Create template (upload image to GridFS)
router.post('/', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file is required' });
    const { name = path.parse(req.file.originalname).name } = req.body;

    // derive metadata using sharp from buffer
    const meta = await sharp(req.file.buffer).metadata();

    // store original image in GridFS under bucket 'templates'
    const gridId = await uploadBuffer({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      contentType: req.file.mimetype,
      bucketName: 'templates',
    });

    const doc = await Template.create({
      name,
      image: { storage: 'gridfs', key: String(gridId), url: `/files/templates/${gridId}` },
      imageMeta: { width: meta.width, height: meta.height, size: req.file.size },
      fields: [],
      mapping: {},
    });

    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
});









// Update fields and/or mapping together
router.put('/:id/layout', async (req, res, next) => {
  try {
    const { fields, mapping } = req.body;
    const update = {};
    if (Array.isArray(fields)) update.fields = fields;
    if (mapping && typeof mapping === 'object') update.mapping = mapping;
    const item = await Template.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true }
    );
    res.json(item);
  } catch (err) {
    next(err);
  }
});



module.exports = router;

