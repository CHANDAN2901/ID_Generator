const mongoose = require('mongoose');

const DatasetSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    sourceFile: {
      storage: { type: String, enum: ['local', 's3', 'gridfs'], default: 'gridfs' },
      key: String,
      url: String,
      size: Number,
    },
    headers: [String],
    rowCount: { type: Number, default: 0 },
    rows: [{ data: { type: Object, default: {} } }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Dataset', DatasetSchema);
