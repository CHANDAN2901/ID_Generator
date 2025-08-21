const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const gridfs = require('./gridfs');

// Simple text rendering using SVG overlay for Sharp
function makeTextSVG({ text, width, height, style = {} }) {
  const {
    fontFamily = 'Arial',
    fontSize = 18,
    color = '#000000',
    bold = false,
    italic = false,
    align = 'left',
  } = style;
  const weight = bold ? '700' : '400';
  const fontStyle = italic ? 'italic' : 'normal';
  const anchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start';
  const x = align === 'center' ? width / 2 : align === 'right' ? width : 0;
  return Buffer.from(
    `<svg width="${width}" height="${height}">
      <style>
        .t { font-family: ${fontFamily}; font-size: ${fontSize}px; fill: ${color}; font-weight: ${weight}; font-style: ${fontStyle}; }
      </style>
      <text x="${x}" y="${Math.max(fontSize, 4)}" text-anchor="${anchor}" class="t">${String(text || '')}</text>
    </svg>`
  );
}

function looksLikeImageUrl(v = '') {
  if (typeof v !== 'string') return false;
  return /^(https?:)?\/\//i.test(v) || /^data:image\//i.test(v) || /^\/files\//i.test(v) || /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(v);
}

async function fetchBufferFromUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // follow redirects
          return fetchBufferFromUrl(res.headers.location).then(resolve, reject);
        }
        if (res.statusCode && res.statusCode >= 400) {
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      })
      .on('error', reject);
  });
}

async function loadImageBuffer(value) {
  try {
    if (!value) return null;
    if (typeof value !== 'string') return null;
    if (/^data:image\//i.test(value)) {
      const base64 = value.split(',')[1] || '';
      return Buffer.from(base64, 'base64');
    }
    // Handle internal GridFS file URLs like /files/:bucket/:id
    const filesMatch = value.match(/^\/files\/([^\/]+)\/([a-f0-9]{24})(?:$|\b)/i);
    if (filesMatch) {
      const bucket = filesMatch[1];
      const id = filesMatch[2];
      try {
        const buf = await gridfs.readFileBuffer(id, bucket);
        if (buf) return buf;
      } catch (e) {
        // fall through to other strategies
      }
    }
    if (/^https?:\/\//i.test(value)) {
      return await fetchBufferFromUrl(value);
    }
    // treat as local path (absolute URL path from our server or filesystem path)
    let p = value;
    if (p.startsWith('/')) p = p.replace(/^\/+/, '');
    const abs = path.join(process.cwd(), p);
    if (fs.existsSync(abs)) {
      return fs.readFileSync(abs);
    }
  } catch (e) {
    console.warn('loadImageBuffer failed for', value, e.message);
  }
  return null;
}

async function renderOne({ template, record }) {
  console.log('renderOne called with:');
  console.log('- Template fields:', template.fields?.length);
  console.log('- Template mapping:', template.mapping);
  console.log('- Record:', record);

  const isHexId = /^[a-f0-9]{24}$/i.test(String(template.image.key || ''));
  const fromGrid = template.image.storage === 'gridfs' || isHexId;
  const baseBuf = fromGrid ? await gridfs.readFileBuffer(template.image.key, 'templates') : null;
  const baseImg = baseBuf ? sharp(baseBuf) : sharp(template.image.key);
  const meta = await baseImg.metadata();

  const composites = [];
  for (const field of template.fields || []) {
    const { type, x, y, width, height, style, id } = field;
    const sourceValue = template.mapping?.[id] ? record[template.mapping[id]] : undefined;
    
    // ADD DEBUGGING
    console.log(`Field ${field.name}:`, {
      id,
      mappedTo: template.mapping?.[id],
      sourceValue,
      position: { x, y, width, height }
    });

    // If explicitly an image field OR a text field that looks like an image URL, compose image
    if ((type === 'image' || (type !== 'image' && looksLikeImageUrl(String(sourceValue || '')))) && sourceValue) {
      const buf = await loadImageBuffer(String(sourceValue));
      if (buf) {
        try {
          const resized = await sharp(buf).resize({ width: Math.round(width), height: Math.round(height), fit: 'cover' }).toBuffer();
          composites.push({ input: resized, left: Math.round(x), top: Math.round(y) });
          continue; // done with this field
        } catch (e) {
          console.warn('Failed to compose image for field', id, e.message);
        }
      }
      // fall through to text if we could not load image
    }

    // Default: render as text
    const svg = makeTextSVG({ text: sourceValue, width, height, style });
    composites.push({ input: svg, left: Math.round(x), top: Math.round(y) });
  }

  const buf = await baseImg.composite(composites).png().toBuffer();
  return { buffer: buf, width: meta.width, height: meta.height };
}

module.exports = { renderOne };

