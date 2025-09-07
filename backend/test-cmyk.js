#!/usr/bin/env node

const { isGhostscriptAvailable, convertToCMYKWithValidation, validateCMYKPDF, CMYK_COLORS } = require('./src/utils/cmykPdf');
const PDFDocument = require('pdfkit');
const sharp = require('sharp');

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
  
  // Create a test image with RGB content
  console.log('2. Creating test image with RGB content...');
  const testImageBuffer = await sharp({
    create: {
      width: 200,
      height: 100,
      channels: 3,
      background: { r: 255, g: 100, b: 50 } // RGB orange
    }
  })
  .png()
  .toBuffer();

  // Create a comprehensive test PDF with vectors AND images
  console.log('3. Creating test PDF with vectors and images...');
  const doc = new PDFDocument({ 
    size: 'A4', 
    margin: 50,
    colorSpace: 'DeviceCMYK' // Start with CMYK color space
  });
  const chunks = [];
  
  doc.on('data', chunk => chunks.push(chunk));
  
  // Add vector content with CMYK colors
  doc.fillColor(CMYK_COLORS.BLACK)
     .fontSize(20)
     .text('Enhanced CMYK Test Document', 50, 50);
  
  doc.fillColor(CMYK_COLORS.DARK_BLUE)
     .fontSize(14)
     .text('Vector text in CMYK dark blue', 50, 100);
  
  doc.fillColor(CMYK_COLORS.RED)
     .text('Vector text in CMYK red', 50, 130);
  
  doc.fillColor(CMYK_COLORS.GREEN)
     .text('Vector text in CMYK green', 50, 160);
  
  // Add vector shapes with CMYK colors
  doc.fillColor(CMYK_COLORS.CYAN)
     .rect(50, 200, 100, 50)
     .fill();
     
  doc.fillColor(CMYK_COLORS.MAGENTA)
     .rect(160, 200, 100, 50)
     .fill();
     
  doc.fillColor(CMYK_COLORS.YELLOW)
     .rect(270, 200, 100, 50)
     .fill();
  
  // Add RGB image that needs conversion
  doc.fillColor(CMYK_COLORS.BLACK)
     .fontSize(12)
     .text('RGB Image (should be converted to CMYK):', 50, 270);
     
  doc.image(testImageBuffer, 50, 290, { width: 200, height: 100 });
  
  // Add CMYK color labels
  doc.fillColor(CMYK_COLORS.BLACK)
     .fontSize(8)
     .text('C', 90, 255)
     .text('M', 200, 255)
     .text('Y', 310, 255);
  
  doc.end();
  
  return new Promise((resolve, reject) => {
    doc.on('end', async () => {
      try {
        const rgbBuffer = Buffer.concat(chunks);
        console.log(`   Original PDF created: ${(rgbBuffer.length / 1024).toFixed(1)} KB`);
        
        // Validate original PDF
        console.log('4. Analyzing original PDF...');
        const originalValidation = await validateCMYKPDF(rgbBuffer);
        console.log(`   Original has CMYK: ${originalValidation.isCMYK}`);
        console.log(`   Original has RGB: ${originalValidation.hasRGB}`);
        
        // Enhanced CMYK conversion with validation
        console.log('5. Converting to fully CMYK (vectors + images)...');
        const conversionResult = await convertToCMYKWithValidation(rgbBuffer, {
          imageQuality: 'high',
          preserveTransparency: false
        });
        
        console.log(`   CMYK PDF created: ${(conversionResult.size / 1024).toFixed(1)} KB`);
        console.log(`   Compression ratio: ${conversionResult.validation.fullyConverted ? 'Fully converted' : 'Partial conversion'}`);
        console.log(`   Size change: ${((conversionResult.size / conversionResult.originalSize - 1) * 100).toFixed(1)}%`);
        
        // Detailed validation results
        console.log('\n📊 Conversion Results:');
        console.log(`   ✅ Fully CMYK: ${conversionResult.fullyConverted ? 'Yes' : 'No'}`);
        console.log(`   🎨 Has CMYK content: ${conversionResult.validation.isCMYK ? 'Yes' : 'No'}`);
        console.log(`   🖥️ Has RGB content: ${conversionResult.validation.hasRGB ? 'Yes' : 'No'}`);
        
        if (conversionResult.fullyConverted) {
          console.log('\n🎉 Perfect! Your system generates fully CMYK PDFs.');
          console.log('   Both vector elements AND images are converted to CMYK.');
        } else {
          console.log('\n⚠️  Partial conversion. Some elements may still be RGB.');
          console.log('   Check Ghostscript version and configuration.');
        }
        
        // Save test files for inspection
        const fs = require('fs');
        fs.writeFileSync('test-original.pdf', rgbBuffer);
        fs.writeFileSync('test-cmyk.pdf', conversionResult.buffer);
        console.log('\n📁 Test files saved:');
        console.log('   - test-original.pdf (original with RGB elements)');
        console.log('   - test-cmyk.pdf (converted to CMYK)');
        
        resolve();
      } catch (error) {
        console.error('\n❌ Enhanced CMYK conversion failed:', error.message);
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