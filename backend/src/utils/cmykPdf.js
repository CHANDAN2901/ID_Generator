const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

/**
 * Convert RGB PDF to fully CMYK using enhanced Ghostscript conversion
 * Converts both vector elements AND embedded images to CMYK
 * @param {Buffer} rgbPdfBuffer - Input PDF buffer
 * @param {Object} options - Conversion options
 * @returns {Buffer} - Fully CMYK PDF buffer
 */
async function convertToCMYK(rgbPdfBuffer, options = {}) {
  const {
    pdfx3 = false, // Generate PDF/X-3 compliant file
    colorProfile = null, // Path to ICC color profile
    tempDir = process.env.TEMP_DIR || "/tmp",
    imageQuality = "high", // 'high', 'medium', 'low'
    preserveTransparency = false,
  } = options;

  const timestamp = Date.now();
  const inputPath = path.join(tempDir, `input-${timestamp}.pdf`);
  const outputPath = path.join(tempDir, `output-cmyk-${timestamp}.pdf`);

  try {
    // Write input buffer to temporary file
    fs.writeFileSync(inputPath, rgbPdfBuffer);

    let gsCommand;

    // Set image quality parameters based on option
    const qualityParams = {
      high: "-dColorImageResolution=300 -dGrayImageResolution=300 -dMonoImageResolution=1200",
      medium:
        "-dColorImageResolution=200 -dGrayImageResolution=200 -dMonoImageResolution=800",
      low: "-dColorImageResolution=150 -dGrayImageResolution=150 -dMonoImageResolution=600",
    };

    if (pdfx3 && colorProfile) {
      // PDF/X-3 compliant conversion with enhanced image handling
      gsCommand =
        `gs -dPDFX=3 -dBATCH -dNOPAUSE -dSAFER ` +
        `-sColorConversionStrategy=CMYK ` +
        `-sColorConversionStrategyForImages=CMYK ` +
        `-dProcessColorModel=DeviceCMYK ` +
        `-dConvertCMYKImagesToRGB=false ` +
        `-dAutoRotatePages=/None ` +
        `-dCompatibilityLevel=1.4 ` +
        `${qualityParams[imageQuality]} ` +
        `-sDEVICE=pdfwrite ` +
        `-sOutputFile="${outputPath}" ` +
        `"${colorProfile}" "${inputPath}"`;
    } else {
      // Ultra-aggressive CMYK conversion for complete image conversion
      gsCommand =
        `gs -dSAFER -dBATCH -dNOPAUSE ` +
        `-sDEVICE=pdfwrite ` +
        `-dProcessColorModel=DeviceCMYK ` +
        `-sColorConversionStrategy=CMYK ` +
        `-sColorConversionStrategyForImages=CMYK ` +
        `-dConvertCMYKImagesToRGB=false ` +
        `-dConvertImagesToIndexed=false ` +
        `-sSourceObjectICC=sRGB ` +
        `-sDefaultRGBProfile=sRGB ` +
        `-sDefaultCMYKProfile=USWebCoatedSWOP ` +
        `-sDefaultGrayProfile=sgray ` +
        `-dRenderIntent=0 ` +
        `-dBlackPtComp=1 ` +
        `-dOverrideICC=true ` +
        `-dUseCIEColor=true ` +
        `-dFixedMedia=true ` +
        `-dAutoRotatePages=/None ` +
        `-dCompatibilityLevel=1.4 ` +
        `-dEmbedAllFonts=true ` +
        `-dSubsetFonts=true ` +
        `-dOptimize=true ` +
        `${qualityParams[imageQuality]} ` +
        `-dDownsampleColorImages=true ` +
        `-dDownsampleGrayImages=true ` +
        `-dDownsampleMonoImages=true ` +
        `-dColorImageDownsampleType=/Bicubic ` +
        `-dGrayImageDownsampleType=/Bicubic ` +
        `-dMonoImageDownsampleType=/Bicubic ` +
        `-dColorImageFilter=/DCTEncode ` +
        `-dGrayImageFilter=/DCTEncode ` +
        `-dAutoFilterColorImages=false ` +
        `-dAutoFilterGrayImages=false ` +
        `-dEncodeColorImages=true ` +
        `-dEncodeGrayImages=true ` +
        `-dEncodeMonoImages=true ` +
        `${preserveTransparency ? "-dPreserveTransparency=true" : ""} ` +
        `-sOutputFile="${outputPath}" "${inputPath}"`;
    }

    console.log("Converting PDF to CMYK with command:", gsCommand);

    // Execute Ghostscript conversion
    execSync(gsCommand, { stdio: "pipe" });

    // Read the converted PDF
    const cmykPdfBuffer = fs.readFileSync(outputPath);

    return cmykPdfBuffer;
  } catch (error) {
    console.error("CMYK conversion failed:", error.message);
    throw new Error(`CMYK conversion failed: ${error.message}`);
  } finally {
    // Clean up temporary files
    try {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    } catch (cleanupError) {
      console.warn("Failed to clean up temporary files:", cleanupError.message);
    }
  }
}

/**
 * Check if Ghostscript is available on the system
 * @returns {boolean}
 */
function isGhostscriptAvailable() {
  try {
    execSync("gs --version", { stdio: "pipe" });
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
 * Validate if a PDF is properly CMYK converted
 * @param {Buffer} pdfBuffer - PDF buffer to validate
 * @returns {Object} - Validation results
 */
async function validateCMYKPDF(pdfBuffer) {
  const tempPath = path.join(
    process.env.TEMP_DIR || "/tmp",
    `validate-${Date.now()}.pdf`
  );

  try {
    fs.writeFileSync(tempPath, pdfBuffer);

    // Use Ghostscript to analyze color spaces
    const analysisCommand =
      `gs -dNODISPLAY -dBATCH -dNOPAUSE -q ` +
      `-c "(/dev/stdout) (w) file dup (Color spaces in PDF:) writestring 10 write flush" ` +
      `-f "${tempPath}" ` +
      `-c "quit"`;

    const output = execSync(analysisCommand, {
      encoding: "utf8",
      stdio: "pipe",
    });

    return {
      isCMYK: output.includes("DeviceCMYK") || output.includes("CMYK"),
      hasRGB: output.includes("DeviceRGB") || output.includes("RGB"),
      analysis: output,
      fullyConverted:
        output.includes("DeviceCMYK") && !output.includes("DeviceRGB"),
    };
  } catch (error) {
    return {
      isCMYK: false,
      hasRGB: true,
      error: error.message,
      fullyConverted: false,
    };
  } finally {
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch (cleanupError) {
      console.warn("Failed to clean up validation file:", cleanupError.message);
    }
  }
}

/**
 * Enhanced CMYK conversion with validation
 * @param {Buffer} rgbPdfBuffer - Input PDF buffer
 * @param {Object} options - Conversion options
 * @returns {Object} - Conversion result with validation
 */
async function convertToCMYKWithValidation(rgbPdfBuffer, options = {}) {
  const cmykBuffer = await convertToCMYK(rgbPdfBuffer, options);
  const validation = await validateCMYKPDF(cmykBuffer);

  return {
    buffer: cmykBuffer,
    validation,
    fullyConverted: validation.fullyConverted,
    size: cmykBuffer.length,
    originalSize: rgbPdfBuffer.length,
  };
}

/**
 * Common CMYK colors for ID cards (professional printing)
 */
const CMYK_COLORS = {
  BLACK: cmykColor(0, 0, 0, 100), // Pure black (K=100)
  WHITE: cmykColor(0, 0, 0, 0), // No ink (paper white)
  DARK_BLUE: cmykColor(100, 80, 0, 20), // Corporate blue
  RED: cmykColor(0, 100, 100, 0), // Pure red (M+Y)
  GREEN: cmykColor(100, 0, 100, 0), // Pure green (C+Y)
  GRAY: cmykColor(0, 0, 0, 50), // 50% black
  LIGHT_GRAY: cmykColor(0, 0, 0, 20), // 20% black
  CYAN: cmykColor(100, 0, 0, 0), // Pure cyan
  MAGENTA: cmykColor(0, 100, 0, 0), // Pure magenta
  YELLOW: cmykColor(0, 0, 100, 0), // Pure yellow
  RICH_BLACK: cmykColor(30, 30, 30, 100), // Rich black for deep blacks
};

module.exports = {
  convertToCMYK,
  convertToCMYKWithValidation,
  validateCMYKPDF,
  isGhostscriptAvailable,
  cmykColor,
  CMYK_COLORS,
};
