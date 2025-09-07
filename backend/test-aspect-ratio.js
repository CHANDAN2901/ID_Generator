#!/usr/bin/env node

const PDFDocument = require('pdfkit');
const sharp = require('sharp');
const fs = require('fs');

async function testAspectRatio() {
  console.log('🧪 Testing Aspect Ratio Preservation in PDF\n');
  
  // Create a test image with known dimensions
  const testImageBuffer = await sharp({
    create: {
      width: 400,
      height: 250,
      channels: 3,
      background: { r: 255, g: 0, b: 0 }
    }
  })
  .png()
  .toBuffer();
  
  console.log('Created test image: 400x250 (aspect ratio: 1.6)');
  
  // Test the PDF generation
  const doc = new PDFDocument({ size: 'A4', margin: 20 });
  const chunks = [];
  
  doc.on('data', chunk => chunks.push(chunk));
  
  // Simulate the fixed layout calculation
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 20;
  const usableWidth = pageWidth - 2 * margin;
  const usableHeight = pageHeight - 2 * margin;
  
  const templateWidth = 400;
  const templateHeight = 250;
  const templateAspectRatio = templateWidth / templateHeight;
  
  console.log(`Template aspect ratio: ${templateAspectRatio.toFixed(2)}`);
  
  // Calculate optimal card size
  let bestLayout = null;
  let maxCardsPerPage = 0;
  
  for (let testWidth = 200; testWidth <= Math.min(400, usableWidth); testWidth += 20) {
    const testHeight = testWidth / templateAspectRatio;
    const testCardsPerRow = Math.floor(usableWidth / testWidth);
    const testCardsPerCol = Math.floor(usableHeight / testHeight);
    const testCardsPerPage = testCardsPerRow * testCardsPerCol;
    
    if (testCardsPerPage > maxCardsPerPage && testCardsPerRow > 0 && testCardsPerCol > 0) {
      maxCardsPerPage = testCardsPerPage;
      bestLayout = {
        cardWidth: testWidth,
        cardHeight: testHeight,
        cardsPerRow: testCardsPerRow,
        cardsPerCol: testCardsPerCol,
        cardsPerPage: testCardsPerPage
      };
    }
  }
  
  const { cardWidth, cardHeight, cardsPerRow, cardsPerCol, cardsPerPage } = bestLayout;
  
  console.log(`Optimal layout: ${cardWidth.toFixed(1)}x${cardHeight.toFixed(1)} points`);
  console.log(`Grid: ${cardsPerRow} x ${cardsPerCol} = ${cardsPerPage} cards per page`);
  
  // Test image placement with aspect ratio preservation
  const imageInfo = await sharp(testImageBuffer).metadata();
  const imageAspectRatio = imageInfo.width / imageInfo.height;
  
  console.log(`Image aspect ratio: ${imageAspectRatio.toFixed(2)}`);
  
  let finalWidth, finalHeight;
  
  if (imageAspectRatio > (cardWidth / cardHeight)) {
    finalWidth = cardWidth;
    finalHeight = cardWidth / imageAspectRatio;
  } else {
    finalHeight = cardHeight;
    finalWidth = cardHeight * imageAspectRatio;
  }
  
  console.log(`Final image size in PDF: ${finalWidth.toFixed(1)}x${finalHeight.toFixed(1)} points`);
  console.log(`Final aspect ratio: ${(finalWidth / finalHeight).toFixed(2)}`);
  
  // Add test images to PDF
  for (let i = 0; i < Math.min(cardsPerPage, 4); i++) {
    const row = Math.floor(i / cardsPerRow);
    const col = i % cardsPerRow;
    
    const horizontalSpacing = (usableWidth - cardsPerRow * cardWidth) / (cardsPerRow + 1);
    const verticalSpacing = (usableHeight - cardsPerCol * cardHeight) / (cardsPerCol + 1);
    
    const x = margin + horizontalSpacing + col * (cardWidth + horizontalSpacing);
    const y = margin + verticalSpacing + row * (cardHeight + verticalSpacing);
    
    const offsetX = (cardWidth - finalWidth) / 2;
    const offsetY = (cardHeight - finalHeight) / 2;
    
    // Add border to show card bounds
    doc.strokeColor('blue')
       .lineWidth(1)
       .rect(x, y, cardWidth, cardHeight)
       .stroke();
    
    // Add image with preserved aspect ratio
    doc.image(testImageBuffer, x + offsetX, y + offsetY, { 
      width: finalWidth, 
      height: finalHeight 
    });
    
    // Add label
    doc.fillColor('black')
       .fontSize(8)
       .text(`Card ${i + 1}`, x + 5, y + cardHeight - 15);
  }
  
  doc.end();
  
  return new Promise((resolve) => {
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      fs.writeFileSync('test-aspect-ratio.pdf', pdfBuffer);
      console.log('\n✅ Test PDF created: test-aspect-ratio.pdf');
      console.log('🔍 Check the PDF to verify aspect ratios are preserved');
      resolve();
    });
  });
}

if (require.main === module) {
  testAspectRatio().catch(console.error);
}

module.exports = { testAspectRatio };