const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const Template = require('../models/Template');
const { uploadBuffer, deleteFile } = require('../utils/gridfs');

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

// List templates
router.get('/', async (req, res, next) => {
  try {
    const items = await Template.find().sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    next(err);
  }
});

// Get template by id
router.get('/:id', async (req, res, next) => {
  try {
    const item = await Template.findById(req.params.id);
    if (!item) return res.sendStatus(404);
    res.json(item);
  } catch (err) {
    next(err);
  }
});

// Update fields
router.put('/:id/fields', async (req, res, next) => {
  try {
    const { fields } = req.body;
    const item = await Template.findByIdAndUpdate(
      req.params.id,
      { $set: { fields } },
      { new: true }
    );
    res.json(item);
  } catch (err) {
    next(err);
  }
});

// Update mapping
router.put('/:id/mapping', async (req, res, next) => {
  try {
    const { mapping } = req.body;
    const item = await Template.findByIdAndUpdate(
      req.params.id,
      { $set: { mapping } },
      { new: true }
    );
    res.json(item);
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


// Delete template
router.delete('/:id', async (req, res, next) => {
  try {
    const item = await Template.findByIdAndDelete(req.params.id);
    if (!item) return res.sendStatus(404);
    // delete file from GridFS if applicable
    if (item.image?.storage === 'gridfs' && item.image?.key) {
      try { await deleteFile(item.image.key, 'templates'); } catch (_) {}
    }
    res.sendStatus(204);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

