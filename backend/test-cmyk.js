#!/usr/bin/env node

const { isGhostscriptAvailable, convertToCMYK, CMYK_COLORS } = require('./src/utils/cmykPdf');
const PDFDocument = require('pdfkit');

async function testCMYK() {
  console.log('🧪 Testing CMYK PDF Generation\n');
  
  // Check Ghostscript availability
  console.log('1. Checking Ghostscript availability...');
  const gsAvailable = isGhostscriptAvailable();
  console.log(`   Ghostscript: ${gsAvailable ? '✅ Available' : '❌ Not found'}\n`);
  
  if (!gsAvailable) {
    console.log('⚠️  Ghostscript not available. Run: npm run setup-cmyk');
    return;
  }
  
  // Create a test PDF
  console.log('2. Creating test PDF...');
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks = [];
  
  doc.on('data', chunk => chunks.push(chunk));
  
  // Add some content with CMYK colors
  doc.fillColor(CMYK_COLORS.BLACK)
     .fontSize(20)
     .text('CMYK Test Document', 50, 50);
  
  doc.fillColor(CMYK_COLORS.DARK_BLUE)
     .fontSize(14)
     .text('This is dark blue text in CMYK color space', 50, 100);
  
  doc.fillColor(CMYK_COLORS.RED)
     .text('This is red text in CMYK color space', 50, 130);
  
  doc.fillColor(CMYK_COLORS.GREEN)
     .text('This is green text in CMYK color space', 50, 160);
  
  // Add a rectangle with CMYK color
  doc.fillColor(CMYK_COLORS.GRAY)
     .rect(50, 200, 200, 100)
     .fill();
  
  doc.fillColor(CMYK_COLORS.WHITE)
     .text('White text on gray background', 60, 240);
  
  doc.end();
  
  return new Promise((resolve, reject) => {
    doc.on('end', async () => {
      try {
        const rgbBuffer = Buffer.concat(chunks);
        console.log(`   RGB PDF created: ${rgbBuffer.length} bytes`);
        
        // Convert to CMYK
        console.log('3. Converting to CMYK...');
        const cmykBuffer = await convertToCMYK(rgbBuffer);
        console.log(`   CMYK PDF created: ${cmykBuffer.length} bytes`);
        
        console.log('\n✅ CMYK conversion test successful!');
        console.log('🎉 Your system is ready for CMYK PDF generation.');
        
        resolve();
      } catch (error) {
        console.error('\n❌ CMYK conversion failed:', error.message);
        reject(error);
      }
    });
    
    doc.on('error', reject);
  });
}

if (require.main === module) {
  testCMYK().catch(console.error);
}

module.exports = { testCMYK };