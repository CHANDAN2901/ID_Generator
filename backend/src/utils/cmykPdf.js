const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Convert RGB PDF to CMYK using Ghostscript
 * @param {Buffer} rgbPdfBuffer - Input PDF buffer
 * @param {Object} options - Conversion options
 * @returns {Buffer} - CMYK PDF buffer
 */
async function convertToCMYK(rgbPdfBuffer, options = {}) {
  const {
    pdfx3 = false, // Generate PDF/X-3 compliant file
    colorProfile = null, // Path to ICC color profile
    tempDir = '/tmp'
  } = options;

  const timestamp = Date.now();
  const inputPath = path.join(tempDir, `input-${timestamp}.pdf`);
  const outputPath = path.join(tempDir, `output-cmyk-${timestamp}.pdf`);

  try {
    // Write input buffer to temporary file
    fs.writeFileSync(inputPath, rgbPdfBuffer);

    let gsCommand;

    if (pdfx3 && colorProfile) {
      // PDF/X-3 compliant conversion
      gsCommand = `gs -dPDFX=3 -dBATCH -dNOPAUSE -dSAFER ` +
        `-sColorConversionStrategy=CMYK ` +
        `-dProcessColorModel=DeviceCMYK ` +
        `-sDEVICE=pdfwrite ` +
        `-sOutputFile="${outputPath}" ` +
        `"${colorProfile}" "${inputPath}"`;
    } else {
      // Standard CMYK conversion
      gsCommand = `gs -dSAFER -dBATCH -dNOPAUSE ` +
        `-sDEVICE=pdfwrite ` +
        `-dProcessColorModel=DeviceCMYK ` +
        `-sColorConversionStrategy=CMYK ` +
        `-dOverrideICC=true ` +
        `-sOutputFile="${outputPath}" "${inputPath}"`;
    }

    console.log('Converting PDF to CMYK with command:', gsCommand);
    
    // Execute Ghostscript conversion
    execSync(gsCommand, { stdio: 'pipe' });

    // Read the converted PDF
    const cmykPdfBuffer = fs.readFileSync(outputPath);

    return cmykPdfBuffer;
  } catch (error) {
    console.error('CMYK conversion failed:', error.message);
    throw new Error(`CMYK conversion failed: ${error.message}`);
  } finally {
    // Clean up temporary files
    try {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    } catch (cleanupError) {
      console.warn('Failed to clean up temporary files:', cleanupError.message);
    }
  }
}

/**
 * Check if Ghostscript is available on the system
 * @returns {boolean}
 */
function isGhostscriptAvailable() {
  try {
    execSync('gs --version', { stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Create CMYK color array for PDFKit
 * @param {number} c - Cyan (0-100)
 * @param {number} m - Magenta (0-100) 
 * @param {number} y - Yellow (0-100)
 * @param {number} k - Black (0-100)
 * @returns {Array} - CMYK array for PDFKit [0-1, 0-1, 0-1, 0-1]
 */
function cmykColor(c, m, y, k) {
  return [c / 100, m / 100, y / 100, k / 100];
}

/**
 * Common CMYK colors for ID cards
 */
const CMYK_COLORS = {
  BLACK: cmykColor(0, 0, 0, 100),
  WHITE: cmykColor(0, 0, 0, 0),
  DARK_BLUE: cmykColor(100, 80, 0, 20),
  RED: cmykColor(0, 100, 100, 0),
  GREEN: cmykColor(100, 0, 100, 0),
  GRAY: cmykColor(0, 0, 0, 50),
  LIGHT_GRAY: cmykColor(0, 0, 0, 20)
};

module.exports = {
  convertToCMYK,
  isGhostscriptAvailable,
  cmykColor,
  CMYK_COLORS
};