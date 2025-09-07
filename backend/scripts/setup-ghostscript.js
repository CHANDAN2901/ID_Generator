#!/usr/bin/env node

const { execSync } = require('child_process');
const os = require('os');

function checkGhostscript() {
  try {
    const version = execSync('gs --version', { encoding: 'utf8' }).trim();
    console.log(`✅ Ghostscript is already installed: ${version}`);
    return true;
  } catch (error) {
    console.log('❌ Ghostscript is not installed');
    return false;
  }
}

function installGhostscript() {
  const platform = os.platform();
  
  console.log(`\n🔧 Installing Ghostscript for ${platform}...`);
  
  try {
    switch (platform) {
      case 'darwin': // macOS
        console.log('Installing via Homebrew...');
        execSync('brew install ghostscript', { stdio: 'inherit' });
        break;
        
      case 'linux':
        // Try different package managers
        try {
          execSync('which apt-get', { stdio: 'pipe' });
          console.log('Installing via apt-get...');
          execSync('sudo apt-get update && sudo apt-get install -y ghostscript', { stdio: 'inherit' });
        } catch {
          try {
            execSync('which yum', { stdio: 'pipe' });
            console.log('Installing via yum...');
            execSync('sudo yum install -y ghostscript', { stdio: 'inherit' });
          } catch {
            try {
              execSync('which dnf', { stdio: 'pipe' });
              console.log('Installing via dnf...');
              execSync('sudo dnf install -y ghostscript', { stdio: 'inherit' });
            } catch {
              throw new Error('No supported package manager found (apt-get, yum, dnf)');
            }
          }
        }
        break;
        
      case 'win32': // Windows
        console.log('Please install Ghostscript manually from: https://www.ghostscript.com/download/gsdnld.html');
        console.log('Make sure to add Ghostscript to your PATH environment variable.');
        return false;
        
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
    
    console.log('✅ Ghostscript installation completed');
    return true;
    
  } catch (error) {
    console.error(`❌ Failed to install Ghostscript: ${error.message}`);
    return false;
  }
}

function main() {
  console.log('🎨 CMYK PDF Setup - Ghostscript Installation\n');
  
  if (checkGhostscript()) {
    console.log('\n🎉 Your system is ready for CMYK PDF generation!');
    return;
  }
  
  const platform = os.platform();
  
  if (platform === 'win32') {
    console.log('\n📋 Manual installation required for Windows:');
    console.log('1. Download Ghostscript from: https://www.ghostscript.com/download/gsdnld.html');
    console.log('2. Install the downloaded package');
    console.log('3. Add Ghostscript to your PATH environment variable');
    console.log('4. Restart your terminal/IDE');
    return;
  }
  
  console.log('\n🤔 Would you like to install Ghostscript automatically? (Ctrl+C to cancel)');
  
  // Auto-install after 3 seconds
  setTimeout(() => {
    if (installGhostscript()) {
      checkGhostscript();
    }
  }, 3000);
}

if (require.main === module) {
  main();
}

module.exports = { checkGhostscript, installGhostscript };