const express = require('express');
const { openDownloadStream, getFileInfo } = require('../utils/gridfs');

const router = express.Router();

// Stream a file from GridFS: /files/:bucket/:id
router.get('/:bucket/:id', async (req, res, next) => {
  try {
    const { bucket, id } = req.params;
    const info = await getFileInfo(id, bucket);
    if (!info) return res.sendStatus(404);

    res.setHeader('Content-Type', info.contentType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    const stream = openDownloadStream(id, bucket);
    stream.on('error', next);
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

