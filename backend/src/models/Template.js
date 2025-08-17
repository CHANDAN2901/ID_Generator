const mongoose = require('mongoose');

const FieldSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, enum: ['text', 'image'], required: true },
    x: Number,
    y: Number,
    width: Number,
    height: Number,
    zIndex: { type: Number, default: 0 },
    style: {
      fontFamily: String,
      fontSize: Number,
      color: String,
      bold: Boolean,
      italic: Boolean,
      align: { type: String, enum: ['left', 'center', 'right'] },
    },
  },
  { _id: false }
);

const TemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    image: {
      storage: { type: String, enum: ['local', 's3', 'gridfs'], default: 'gridfs' },
      key: String,
      url: String,
    },
    imageMeta: {
      width: Number,
      height: Number,
      size: Number,
    },
    fields: [FieldSchema],
    mapping: { type: Object, default: {} }, // fieldId -> column name
  },
  { timestamps: true }
);

module.exports = mongoose.model('Template', TemplateSchema);

