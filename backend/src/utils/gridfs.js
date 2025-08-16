const mongoose = require('mongoose');
const { GridFSBucket, ObjectId } = require('mongodb');

function getBucket(bucketName = 'templates') {
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB not connected');
  return new GridFSBucket(db, { bucketName });
}

function uploadBuffer({ buffer, filename, contentType, bucketName = 'templates' }) {
  return new Promise((resolve, reject) => {
    const bucket = getBucket(bucketName);
    const uploadStream = bucket.openUploadStream(filename || `file-${Date.now()}`, {
      contentType,
    });
    uploadStream.on('error', reject);
    uploadStream.on('finish', () => resolve(uploadStream.id));
    uploadStream.end(buffer);
  });
}

function openDownloadStream(id, bucketName = 'templates') {
  const bucket = getBucket(bucketName);
  return bucket.openDownloadStream(new ObjectId(String(id)));
}

async function readFileBuffer(id, bucketName = 'templates') {
  const stream = openDownloadStream(id, bucketName);
  const chunks = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (c) => chunks.push(c));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

async function deleteFile(id, bucketName = 'templates') {
  const bucket = getBucket(bucketName);
  await bucket.delete(new ObjectId(String(id)));
}

async function getFileInfo(id, bucketName = 'templates') {
  const bucket = getBucket(bucketName);
  const items = await bucket
    .find({ _id: new ObjectId(String(id)) })
    .limit(1)
    .toArray();
  return items[0] || null;
}

module.exports = {
  getBucket,
  uploadBuffer,
  openDownloadStream,
  readFileBuffer,
  deleteFile,
  getFileInfo,
};

