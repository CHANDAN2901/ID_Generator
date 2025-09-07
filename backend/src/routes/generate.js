const express = require("express");
const PDFDocument = require("pdfkit");
const Template = require("../models/Template");
const Dataset = require("../models/Dataset");
const { renderOne } = require("../utils/render");
const { uploadBuffer } = require("../utils/gridfs");
const { convertToCMYK, isGhostscriptAvailable, CMYK_COLORS } = require("../utils/cmykPdf");

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
      console.warn('CMYK conversion requested but Ghostscript not available. Generating RGB PDF.');
    }

    // Create PDF in memory with CMYK-friendly settings
    const doc = new PDFDocument({ 
      size: "A4", 
      margin: 20,
      // Set color space to DeviceCMYK if supported
      colorSpace: shouldConvertToCMYK ? 'DeviceCMYK' : 'DeviceRGB'
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

    // ATM card dimensions (85.60 × 53.98 mm) converted to points (1 mm = 2.834645669 points)
    const cardWidth = 85.6 * 2.834645669; // ~242.65 points
    const cardHeight = 53.98 * 2.834645669; // ~152.95 points

    // Calculate grid layout
    const cardsPerRow = Math.floor(usableWidth / cardWidth);
    const cardsPerCol = Math.floor(usableHeight / cardHeight);
    const cardsPerPage = cardsPerRow * cardsPerCol;

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
      doc.rect(pageWidth - margin, margin - markSize, markSize, markSize).fill();
      doc.rect(margin - markSize, pageHeight - margin, markSize, markSize).fill();
      doc.rect(pageWidth - margin, pageHeight - margin, markSize, markSize).fill();
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
          doc.rect(margin - markSize, margin - markSize, markSize, markSize).fill();
          doc.rect(pageWidth - margin, margin - markSize, markSize, markSize).fill();
          doc.rect(margin - markSize, pageHeight - margin, markSize, markSize).fill();
          doc.rect(pageWidth - margin, pageHeight - margin, markSize, markSize).fill();
        }
      }

      // Calculate position on current page
      const cardIndex = cardCount % cardsPerPage;
      const row = Math.floor(cardIndex / cardsPerRow);
      const col = cardIndex % cardsPerRow;

      const x =
        margin + horizontalSpacing + col * (cardWidth + horizontalSpacing);
      const y = margin + verticalSpacing + row * (cardHeight + verticalSpacing);

      // Add card image to PDF
      doc.image(buffer, x, y, { width: cardWidth, height: cardHeight });

      // Add optional border for cutting guides
      if (shouldConvertToCMYK) {
        doc.strokeColor(CMYK_COLORS.LIGHT_GRAY)
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
            console.log('Converting PDF to CMYK...');
            pdfBuffer = await convertToCMYK(pdfBuffer);
            finalFileName = fileName.replace('.pdf', '-cmyk.pdf');
            console.log('CMYK conversion completed successfully');
          } catch (cmykError) {
            console.error('CMYK conversion failed, using RGB PDF:', cmykError.message);
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
          filename: finalFileName
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
      : "Install Ghostscript to enable CMYK PDF generation"
  });
});

module.exports = router;
