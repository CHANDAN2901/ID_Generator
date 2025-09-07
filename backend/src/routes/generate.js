const express = require("express");
const PDFDocument = require("pdfkit");
const sharp = require("sharp");
const Template = require("../models/Template");
const Dataset = require("../models/Dataset");
const { renderOne } = require("../utils/render");
const { uploadBuffer } = require("../utils/gridfs");
const {
  convertToCMYK,
  convertToCMYKWithValidation,
  isGhostscriptAvailable,
  CMYK_COLORS,
} = require("../utils/cmykPdf");

const router = express.Router();
// Preview: generate single record image and stream back (no disk write)
router.post("/preview", async (req, res, next) => {
  try {
    const { templateId, record } = req.body;
    const template = await Template.findById(templateId).lean();
    if (!template) return res.status(404).json({ error: "Template not found" });

    const { buffer } = await renderOne({ template, record });
    const fileName = `preview-${Date.now()}.png`;
    // Store preview in GridFS (optional). For now just return a data URL path served by a short-lived route
    // Simpler: write to /uploads/previews as before but we aim to remove local writes in a later step
    // For immediate UX, we can inline as base64 data, but frontend expects a URL; keep local write for now? We'll switch to data URL:
    const b64 = `data:image/png;base64,${buffer.toString("base64")}`;
    res.json({ previewUrl: b64 });
  } catch (err) {
    next(err);
  }
});

// Batch: dataset -> single PDF output (CMYK COMPATIBLE)
router.post("/batch", async (req, res, next) => {
  try {
    const { templateId, datasetId, range, cmyk = true } = req.body;
    const template = await Template.findById(templateId).lean();
    if (!template) return res.status(404).json({ error: "Template not found" });

    const dataset = await Dataset.findById(datasetId).lean();
    if (!dataset) return res.status(404).json({ error: "Dataset not found" });

    const rows = dataset.rows || [];
    const start = range?.start ?? 0;
    const end = Math.min(range?.end ?? rows.length, rows.length);

    const fileName = `batch-${Date.now()}.pdf`;

    // Check if CMYK conversion is requested and Ghostscript is available
    const shouldConvertToCMYK = cmyk && isGhostscriptAvailable();
    if (cmyk && !isGhostscriptAvailable()) {
      console.warn(
        "CMYK conversion requested but Ghostscript not available. Generating RGB PDF."
      );
    }

    // Create PDF in memory with enhanced CMYK settings
    const doc = new PDFDocument({
      size: "A4",
      margin: 20,
      // Enhanced CMYK settings for professional printing
      colorSpace: shouldConvertToCMYK ? "DeviceCMYK" : "DeviceRGB",
      pdfVersion: "1.4", // Ensure compatibility with CMYK workflows
      compress: false, // Better for CMYK conversion
    });
    const chunks = [];

    // Collect PDF data in memory
    doc.on("data", (chunk) => chunks.push(chunk));

    // A4 dimensions in points (72 DPI): 595.28 x 841.89
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 20;
    const usableWidth = pageWidth - 2 * margin;
    const usableHeight = pageHeight - 2 * margin;

    // Get actual template dimensions to preserve aspect ratio
    const templateWidth = template.imageMeta?.width || 400;
    const templateHeight = template.imageMeta?.height || 250;
    const templateAspectRatio = templateWidth / templateHeight;

    console.log(
      `Template dimensions: ${templateWidth} x ${templateHeight} (ratio: ${templateAspectRatio.toFixed(
        2
      )})`
    );

    // Calculate optimal card size for PDF layout while preserving aspect ratio
    // Try different layouts to find the best fit
    let bestLayout = null;
    let maxCardsPerPage = 0;

    // Test different card widths to find optimal layout
    for (
      let testWidth = 200;
      testWidth <= Math.min(400, usableWidth);
      testWidth += 20
    ) {
      const testHeight = testWidth / templateAspectRatio;
      const testCardsPerRow = Math.floor(usableWidth / testWidth);
      const testCardsPerCol = Math.floor(usableHeight / testHeight);
      const testCardsPerPage = testCardsPerRow * testCardsPerCol;

      if (
        testCardsPerPage > maxCardsPerPage &&
        testCardsPerRow > 0 &&
        testCardsPerCol > 0
      ) {
        maxCardsPerPage = testCardsPerPage;
        bestLayout = {
          cardWidth: testWidth,
          cardHeight: testHeight,
          cardsPerRow: testCardsPerRow,
          cardsPerCol: testCardsPerCol,
          cardsPerPage: testCardsPerPage,
        };
      }
    }

    // Use best layout or fallback
    const { cardWidth, cardHeight, cardsPerRow, cardsPerCol, cardsPerPage } =
      bestLayout || {
        cardWidth: 280,
        cardHeight: 280 / templateAspectRatio,
        cardsPerRow: Math.floor(usableWidth / 280),
        cardsPerCol: Math.floor(usableHeight / (280 / templateAspectRatio)),
        cardsPerPage:
          Math.floor(usableWidth / 280) *
          Math.floor(usableHeight / (280 / templateAspectRatio)),
      };

    console.log(
      `PDF Layout: ${cardsPerRow} cards per row, ${cardsPerCol} rows per page = ${cardsPerPage} cards per page`
    );

    // Calculate spacing for centering
    const horizontalSpacing =
      (usableWidth - cardsPerRow * cardWidth) / (cardsPerRow + 1);
    const verticalSpacing =
      (usableHeight - cardsPerCol * cardHeight) / (cardsPerCol + 1);

    let cardCount = 0;
    let isFirstPage = true;

    // Function to add print marks to a page (only when we have content)
    const addPrintMarks = () => {
      if (!shouldConvertToCMYK) return;
      
      // Enhanced crop marks and color registration marks using pure CMYK colors
      doc.fillColor(CMYK_COLORS.BLACK);

      // Corner registration marks with proper crop marks (smaller to avoid issues)
      const markSize = 4;
      const markOffset = 6;

      // Simple corner marks
      doc.rect(margin - markOffset, margin - markOffset, markSize, markSize).fill();
      doc.rect(pageWidth - margin + markOffset - markSize, margin - markOffset, markSize, markSize).fill();
      doc.rect(margin - markOffset, pageHeight - margin + markOffset - markSize, markSize, markSize).fill();
      doc.rect(pageWidth - margin + markOffset - markSize, pageHeight - margin + markOffset - markSize, markSize, markSize).fill();
    };



    // Process all rows
    for (let i = start; i < end; i++) {
      const record = rows[i].data;
      const { buffer } = await renderOne({ template, record });

      // Create new page if needed (first page or when current page is full)
      if (cardCount % cardsPerPage === 0) {
        if (cardCount > 0) {
          doc.addPage();
        }
        // Add print marks only after we have content on the page
        addPrintMarks();
      }

      // Calculate position on current page
      const cardIndex = cardCount % cardsPerPage;
      const row = Math.floor(cardIndex / cardsPerRow);
      const col = cardIndex % cardsPerRow;

      const x =
        margin + horizontalSpacing + col * (cardWidth + horizontalSpacing);
      const y = margin + verticalSpacing + row * (cardHeight + verticalSpacing);

      // Add card image to PDF with proper aspect ratio preservation
      try {
        // Get the actual image dimensions from the buffer
        const imageInfo = await sharp(buffer).metadata();
        const imageAspectRatio = imageInfo.width / imageInfo.height;

        // Calculate the best fit within the card bounds while preserving aspect ratio
        let finalWidth, finalHeight;

        if (imageAspectRatio > cardWidth / cardHeight) {
          // Image is wider relative to card bounds, fit by width
          finalWidth = cardWidth;
          finalHeight = cardWidth / imageAspectRatio;
        } else {
          // Image is taller relative to card bounds, fit by height
          finalHeight = cardHeight;
          finalWidth = cardHeight * imageAspectRatio;
        }

        // Center the image within the card bounds
        const offsetX = (cardWidth - finalWidth) / 2;
        const offsetY = (cardHeight - finalHeight) / 2;

        doc.image(buffer, x + offsetX, y + offsetY, {
          width: finalWidth,
          height: finalHeight,
        });
      } catch (imageError) {
        console.warn(
          "Failed to get image dimensions, using fit method:",
          imageError.message
        );
        // Fallback to fit method - this preserves aspect ratio automatically
        doc.image(buffer, x, y, {
          fit: [cardWidth, cardHeight],
          align: "center",
          valign: "center",
        });
      }

      // Add professional cutting guides using CMYK colors
      if (shouldConvertToCMYK) {
        // Main card border in light gray CMYK
        doc
          .strokeColor(CMYK_COLORS.LIGHT_GRAY)
          .lineWidth(0.5)
          .rect(x, y, cardWidth, cardHeight)
          .stroke();

        // Add corner crop marks for precise cutting
        const cropMarkLength = 6;
        const cropMarkOffset = 2;

        doc
          .strokeColor([0, 0, 0, 0.3]) // 30% black in CMYK
          .lineWidth(0.25);

        // Top-left corner crop marks
        doc
          .moveTo(x - cropMarkOffset, y - cropMarkOffset - cropMarkLength)
          .lineTo(x - cropMarkOffset, y - cropMarkOffset)
          .stroke();
        doc
          .moveTo(x - cropMarkOffset - cropMarkLength, y - cropMarkOffset)
          .lineTo(x - cropMarkOffset, y - cropMarkOffset)
          .stroke();

        // Top-right corner crop marks
        doc
          .moveTo(
            x + cardWidth + cropMarkOffset,
            y - cropMarkOffset - cropMarkLength
          )
          .lineTo(x + cardWidth + cropMarkOffset, y - cropMarkOffset)
          .stroke();
        doc
          .moveTo(
            x + cardWidth + cropMarkOffset + cropMarkLength,
            y - cropMarkOffset
          )
          .lineTo(x + cardWidth + cropMarkOffset, y - cropMarkOffset)
          .stroke();

        // Bottom-left corner crop marks
        doc
          .moveTo(
            x - cropMarkOffset,
            y + cardHeight + cropMarkOffset + cropMarkLength
          )
          .lineTo(x - cropMarkOffset, y + cardHeight + cropMarkOffset)
          .stroke();
        doc
          .moveTo(
            x - cropMarkOffset - cropMarkLength,
            y + cardHeight + cropMarkOffset
          )
          .lineTo(x - cropMarkOffset, y + cardHeight + cropMarkOffset)
          .stroke();

        // Bottom-right corner crop marks
        doc
          .moveTo(
            x + cardWidth + cropMarkOffset,
            y + cardHeight + cropMarkOffset + cropMarkLength
          )
          .lineTo(
            x + cardWidth + cropMarkOffset,
            y + cardHeight + cropMarkOffset
          )
          .stroke();
        doc
          .moveTo(
            x + cardWidth + cropMarkOffset + cropMarkLength,
            y + cardHeight + cropMarkOffset
          )
          .lineTo(
            x + cardWidth + cropMarkOffset,
            y + cardHeight + cropMarkOffset
          )
          .stroke();
      }

      cardCount++;
    }

    doc.end();

    // Wait for PDF generation to complete, then process for CMYK
    doc.on("end", async () => {
      try {
        let pdfBuffer = Buffer.concat(chunks);
        let finalFileName = fileName;

        // Enhanced CMYK conversion with validation for vectors AND images
        let conversionResult = null;
        if (shouldConvertToCMYK) {
          try {
            console.log("Converting PDF to CMYK (vectors + images)...");

            // Use enhanced conversion with validation
            conversionResult = await convertToCMYKWithValidation(pdfBuffer, {
              imageQuality: "high",
              preserveTransparency: false,
            });

            pdfBuffer = conversionResult.buffer;
            finalFileName = fileName.replace(".pdf", "-cmyk.pdf");

            console.log(`CMYK conversion completed successfully:`);
            console.log(
              `- Fully converted: ${
                conversionResult.fullyConverted ? "Yes" : "No"
              }`
            );
            console.log(
              `- Original size: ${(
                conversionResult.originalSize / 1024
              ).toFixed(1)} KB`
            );
            console.log(
              `- CMYK size: ${(conversionResult.size / 1024).toFixed(1)} KB`
            );

            if (!conversionResult.fullyConverted) {
              console.warn("Warning: PDF may still contain some RGB elements");
            }
          } catch (cmykError) {
            console.error(
              "Enhanced CMYK conversion failed, using RGB PDF:",
              cmykError.message
            );
            // Continue with RGB PDF if CMYK conversion fails
            conversionResult = null;
          }
        }

        // Upload PDF to GridFS 'outputs' bucket
        const fileId = await uploadBuffer({
          buffer: pdfBuffer,
          filename: finalFileName,
          contentType: "application/pdf",
          bucketName: "outputs",
        });

        // Return GridFS file URL instead of local file URL
        const pdfUrl = `/files/outputs/${fileId}`;
        res.json({
          pdfUrl,
          count: end - start,
          fileId,
          cmykCompatible: shouldConvertToCMYK,
          filename: finalFileName,
          // Enhanced CMYK conversion results
          cmykConversion: conversionResult
            ? {
                fullyConverted: conversionResult.fullyConverted,
                originalSize: conversionResult.originalSize,
                cmykSize: conversionResult.size,
                compressionRatio: (
                  conversionResult.size / conversionResult.originalSize
                ).toFixed(2),
                validation: conversionResult.validation,
              }
            : null,
        });
      } catch (uploadErr) {
        next(uploadErr);
      }
    });

    doc.on("error", next);
  } catch (err) {
    next(err);
  }
});

// Check CMYK support endpoint
router.get("/cmyk-support", (req, res) => {
  const ghostscriptAvailable = isGhostscriptAvailable();
  res.json({
    cmykSupported: ghostscriptAvailable,
    ghostscriptAvailable,
    message: ghostscriptAvailable
      ? "CMYK PDF generation is supported"
      : "Install Ghostscript to enable CMYK PDF generation",
  });
});

module.exports = router;
