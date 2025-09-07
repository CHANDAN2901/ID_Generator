#!/usr/bin/env node

const { convertToCMYKWithValidation, isGhostscriptAvailable } = require('./src/utils/cmykPdf');
const PDFDocument = require('pdfkit');
const sharp = require('sharp');
const fs = require('fs');

async function testImageCMYKConversion() {
  console.log('🧪 Testing Image CMYK Conversion Specifically\n');
  
  // Check Ghostscript availability
  console.log('1. Checking Ghostscript availability...');
  const gsAvailable = isGhostscriptAvailable();
  console.log(`   Ghostscript: ${gsAvailable ? '✅ Available' : '❌ Not found'}\n`);
  
  if (!gsAvailable) {
    console.log('⚠️  Ghostscript not available. Run: npm run setup-cmyk');
    return;
  }
  
  // Create test images with different color profiles
  console.log('2. Creating test images with RGB content...');
  
  // Create a vibrant RGB image that should show clear conversion differences
  const rgbImageBuffer = await sharp({
    create: {
      width: 300,
      height: 200,
      channels: 3,
      background: { r: 255, g: 0, b: 128 } // Bright magenta-pink in RGB
    }
  })
  .png()
  .toBuffer();
  
  // Create another RGB image with different colors
  const rgbImageBuffer2 = await sharp({
    create: {
      width: 300,
      height: 200,
      channels: 3,
      background: { r: 0, g: 255, b: 255 } // Cyan in RGB
    }
  })
  .png()
  .toBuffer();
  
  console.log('   Created RGB test images');
  
  // Create a PDF with multiple RGB images
  console.log('3. Creating PDF with RGB images...');
  const doc = new PDFDocument({ 
    size: 'A4', 
    margin: 50,
    compress: false // Don't compress to see conversion effects better
  });
  const chunks = [];
  
  doc.on('data', chunk => chunks.push(chunk));
  
  // Add title
  doc.fillColor('black')
     .fontSize(16)
     .text('RGB to CMYK Image Conversion Test', 50, 50);
  
  // Add RGB images
  doc.fontSize(12)
     .text('RGB Image 1 (Bright Magenta-Pink):', 50, 100);
  doc.image(rgbImageBuffer, 50, 120, { width: 200, height: 133 });
  
  doc.text('RGB Image 2 (Cyan):', 300, 100);
  doc.image(rgbImageBuffer2, 300, 120, { width: 200, height: 133 });
  
  // Add some vector content for comparison
  doc.text('Vector Rectangle (RGB Red):', 50, 280);
  doc.fillColor('red')
     .rect(50, 300, 100, 50)
     .fill();
     
  doc.fillColor('black')
     .text('Vector Rectangle (RGB Blue):', 300, 280);
  doc.fillColor('blue')
     .rect(300, 300, 100, 50)
     .fill();
  
  doc.end();
  
  return new Promise((resolve, reject) => {
    doc.on('end', async () => {
      try {
        const originalBuffer = Buffer.concat(chunks);
        console.log(`   Original PDF created: ${(originalBuffer.length / 1024).toFixed(1)} KB`);
        
        // Save original for comparison
        fs.writeFileSync('test-original-images.pdf', originalBuffer);
        
        // Test different conversion settings
        console.log('4. Testing CMYK conversion with enhanced image settings...');
        
        const conversionResult = await convertToCMYKWithValidation(originalBuffer, {
          imageQuality: 'high',
          preserveTransparency: false
        });
        
        console.log(`   CMYK PDF created: ${(conversionResult.size / 1024).toFixed(1)} KB`);
        console.log(`   Size change: ${((conversionResult.size / conversionResult.originalSize - 1) * 100).toFixed(1)}%`);
        
        // Save CMYK version
        fs.writeFileSync('test-cmyk-images.pdf', conversionResult.buffer);
        
        // Detailed validation results
        console.log('\n📊 Image Conversion Results:');
        console.log(`   ✅ Fully CMYK: ${conversionResult.fullyConverted ? 'Yes' : 'No'}`);
        console.log(`   🎨 Has CMYK content: ${conversionResult.validation.isCMYK ? 'Yes' : 'No'}`);
        console.log(`   🖥️ Has RGB content: ${conversionResult.validation.hasRGB ? 'Yes' : 'No'}`);
        
        if (conversionResult.validation.hasRGB) {
          console.log('\n⚠️  WARNING: Images may still contain RGB data!');
          console.log('   This suggests the Ghostscript image conversion is not working properly.');
          console.log('   Try updating Ghostscript or check the conversion parameters.');
        } else {
          console.log('\n🎉 SUCCESS: All images converted to CMYK!');
          console.log('   The PDF is fully print-ready with CMYK images.');
        }
        
        // Test with external tool command for comparison
        console.log('\n5. Testing with external Ghostscript command...');
        const { execSync } = require('child_process');
        
        try {
          const externalCommand = `gs -dSAFER -dBATCH -dNOPAUSE ` +
            `-sDEVICE=pdfwrite ` +
            `-dProcessColorModel=DeviceCMYK ` +
            `-sColorConversionStrategy=CMYK ` +
            `-sColorConversionStrategyForImages=CMYK ` +
            `-dConvertCMYKImagesToRGB=false ` +
            `-dColorImageResolution=300 ` +
            `-sOutputFile=test-external-cmyk.pdf test-original-images.pdf`;
          
          execSync(externalCommand, { stdio: 'pipe' });
          
          const externalBuffer = fs.readFileSync('test-external-cmyk.pdf');
          console.log(`   External conversion: ${(externalBuffer.length / 1024).toFixed(1)} KB`);
          console.log('   ✅ External conversion completed successfully');
          
        } catch (externalError) {
          console.log(`   ❌ External conversion failed: ${externalError.message}`);
        }
        
        console.log('\n📁 Test files created:');
        console.log('   - test-original-images.pdf (RGB images)');
        console.log('   - test-cmyk-images.pdf (converted via Node.js)');
        console.log('   - test-external-cmyk.pdf (converted via external command)');
        console.log('\n🔍 Compare these files in a PDF viewer to verify image conversion.');
        
        resolve();
      } catch (error) {
        console.error('\n❌ Image CMYK conversion test failed:', error.message);
        reject(error);
      }
    });
    
    doc.on('error', reject);
  });
}

if (require.main === module) {
  testImageCMYKConversion().catch(console.error);
}

module.exports = { testImageCMYKConversion };