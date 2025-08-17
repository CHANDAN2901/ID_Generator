const mongoose = require('mongoose');

const RowSchema = new mongoose.Schema(
  {
    data: { type: Object, required: true }, // key: header, value
  },
  { _id: false }
);

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
    rows: [RowSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Dataset', DatasetSchema);

