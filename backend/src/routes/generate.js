const express = require("express");
const PDFDocument = require("pdfkit");
const sharp = require("sharp");
const Template = require("../models/Template");
const Dataset = require("../models/Dataset");
const { renderOne } = require("../utils/render");
const { uploadBuffer } = require("../utils/gridfs");
const {
  convertToCMYK,
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

    // Create PDF in memory with CMYK-friendly settings
    const doc = new PDFDocument({
      size: "A4",
      margin: 20,
      // Set color space to DeviceCMYK if supported
      colorSpace: shouldConvertToCMYK ? "DeviceCMYK" : "DeviceRGB",
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

    // Add print marks and color bars for professional printing (optional)
    if (shouldConvertToCMYK) {
      // Add crop marks and color registration marks
      doc.fillColor(CMYK_COLORS.BLACK);
      // Add small registration marks at corners
      const markSize = 5;
      doc.rect(margin - markSize, margin - markSize, markSize, markSize).fill();
      doc
        .rect(pageWidth - margin, margin - markSize, markSize, markSize)
        .fill();
      doc
        .rect(margin - markSize, pageHeight - margin, markSize, markSize)
        .fill();
      doc
        .rect(pageWidth - margin, pageHeight - margin, markSize, markSize)
        .fill();
    }

    // Process all rows
    for (let i = start; i < end; i++) {
      const record = rows[i].data;
      const { buffer } = await renderOne({ template, record });

      // Create new page if needed (first page or when current page is full)
      if (cardCount % cardsPerPage === 0) {
        if (cardCount > 0) doc.addPage();

        // Add print marks to each new page
        if (shouldConvertToCMYK) {
          doc.fillColor(CMYK_COLORS.BLACK);
          const markSize = 5;
          doc
            .rect(margin - markSize, margin - markSize, markSize, markSize)
            .fill();
          doc
            .rect(pageWidth - margin, margin - markSize, markSize, markSize)
            .fill();
          doc
            .rect(margin - markSize, pageHeight - margin, markSize, markSize)
            .fill();
          doc
            .rect(pageWidth - margin, pageHeight - margin, markSize, markSize)
            .fill();
        }
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

      // Add optional border for cutting guides
      if (shouldConvertToCMYK) {
        doc
          .strokeColor(CMYK_COLORS.LIGHT_GRAY)
          .lineWidth(0.5)
          .rect(x, y, cardWidth, cardHeight)
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

        // Convert to CMYK if requested and Ghostscript is available
        if (shouldConvertToCMYK) {
          try {
            console.log("Converting PDF to CMYK...");
            pdfBuffer = await convertToCMYK(pdfBuffer);
            finalFileName = fileName.replace(".pdf", "-cmyk.pdf");
            console.log("CMYK conversion completed successfully");
          } catch (cmykError) {
            console.error(
              "CMYK conversion failed, using RGB PDF:",
              cmykError.message
            );
            // Continue with RGB PDF if CMYK conversion fails
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
