# CMYK PDF Generation Setup

This guide explains how to enable CMYK-compatible PDF generation for professional printing in your ID Generator application.

## 🎨 What is CMYK?

CMYK (Cyan, Magenta, Yellow, Black) is the color model used in professional printing. Unlike RGB colors used on screens, CMYK ensures accurate color reproduction when printing ID cards or documents.

## 🔧 Prerequisites

### Install Ghostscript

Ghostscript is required to convert RGB PDFs to CMYK format.

#### Automatic Installation (Recommended)

```bash
cd backend
npm run setup-cmyk
```

#### Manual Installation

**macOS:**

```bash
brew install ghostscript
```

**Ubuntu/Debian:**

```bash
sudo apt-get update
sudo apt-get install ghostscript
```

**CentOS/RHEL:**

```bash
sudo yum install ghostscript
```

**Windows:**

1. Download from: https://www.ghostscript.com/download/gsdnld.html
2. Install the downloaded package
3. Add Ghostscript to your PATH environment variable

### Install Node.js Dependencies

```bash
cd backend
npm install
```

## 🚀 Usage

### API Endpoints

#### Check CMYK Support

```bash
GET /api/generate/cmyk-support
```

Response:

```json
{
  "cmykSupported": true,
  "ghostscriptAvailable": true,
  "message": "CMYK PDF generation is supported"
}
```

#### Generate CMYK PDF

```bash
POST /api/generate/batch
```

Request body:

```json
{
  "templateId": "template_id_here",
  "datasetId": "dataset_id_here",
  "range": { "start": 0, "end": 10 },
  "cmyk": true
}
```

Response:

```json
{
  "pdfUrl": "/files/outputs/file_id",
  "count": 10,
  "fileId": "file_id_here",
  "cmykCompatible": true,
  "filename": "batch-timestamp-cmyk.pdf"
}
```

### Frontend Usage

```javascript
import { batchGenerate, checkCMYKSupport } from "./lib/api.js";

// Check if CMYK is supported
const cmykSupport = await checkCMYKSupport();
console.log("CMYK supported:", cmykSupport.cmykSupported);

// Generate CMYK PDF
const result = await batchGenerate(templateId, datasetId, range, {
  cmyk: true,
});
console.log("Generated CMYK PDF:", result.pdfUrl);

// Generate regular RGB PDF
const rgbResult = await batchGenerate(templateId, datasetId, range, {
  cmyk: false,
});
```

## 🎯 Features

### CMYK Color Support

- Automatic RGB to CMYK conversion using Ghostscript
- CMYK color definitions for consistent printing
- Print registration marks for professional output

### Print-Ready Features

- Crop marks at page corners
- Color registration marks
- Cutting guides around ID cards
- A4 page layout optimized for printing

### Fallback Handling

- Graceful fallback to RGB if Ghostscript is unavailable
- Error handling for conversion failures
- Clear status reporting in API responses

## 🔍 Troubleshooting

### Ghostscript Not Found

```
Error: CMYK conversion failed: Command failed: gs
```

**Solution:** Install Ghostscript using the instructions above.

### Permission Errors (Linux/macOS)

```
Error: Permission denied
```

**Solution:** Ensure Ghostscript has proper permissions:

```bash
sudo chmod +x $(which gs)
```

### Windows PATH Issues

```
Error: 'gs' is not recognized as an internal or external command
```

**Solution:** Add Ghostscript to your Windows PATH:

1. Find Ghostscript installation directory (usually `C:\Program Files\gs\gs9.xx\bin`)
2. Add this path to your system PATH environment variable
3. Restart your terminal/IDE

### Memory Issues with Large Datasets

```
Error: JavaScript heap out of memory
```

**Solution:** Increase Node.js memory limit:

```bash
node --max-old-space-size=4096 src/app.js
```

## 📋 Color Guidelines

### Using CMYK Colors in Templates

When designing templates, use these CMYK-friendly colors:

```javascript
const CMYK_COLORS = {
  BLACK: [0, 0, 0, 1], // Pure black
  WHITE: [0, 0, 0, 0], // No ink
  DARK_BLUE: [1, 0.8, 0, 0.2], // Corporate blue
  RED: [0, 1, 1, 0], // Pure red
  GREEN: [1, 0, 1, 0], // Pure green
  GRAY: [0, 0, 0, 0.5], // 50% black
  LIGHT_GRAY: [0, 0, 0, 0.2], // 20% black
};
```

### Color Conversion Notes

- RGB colors are automatically converted to CMYK
- Some RGB colors may shift slightly in CMYK
- Test print a sample before large batches
- Consider using Pantone colors for brand consistency

## 🎨 Professional Printing Tips

1. **Color Profiles:** Use ICC color profiles for specific printers
2. **Bleed Areas:** Add 3mm bleed around card edges
3. **Safe Zones:** Keep important content 2mm from edges
4. **Resolution:** Use 300 DPI images for crisp printing
5. **Paper Stock:** Choose appropriate cardstock (300-350 GSM recommended)

## 📞 Support

If you encounter issues with CMYK PDF generation:

1. Check Ghostscript installation: `gs --version`
2. Verify API support: `GET /api/generate/cmyk-support`
3. Check server logs for detailed error messages
4. Test with a small dataset first

For additional help, refer to the main project documentation or create an issue in the repository.
