const fs = require('fs');
const path = require('path');

/**
 * Script to copy the generated monochrome icons to Android notification icon locations
 * This fixes the small notification icon issue by using the properly designed monochrome icons
 */

const sourceBase = './IconKitchen-Output/android/res';
const targetBase = './android/app/src/main/res';

// Mapping of source directories to target directories
const densityMappings = [
  { source: 'mipmap-hdpi', target: 'drawable-hdpi' },
  { source: 'mipmap-mdpi', target: 'drawable-mdpi' },
  { source: 'mipmap-xhdpi', target: 'drawable-xhdpi' },
  { source: 'mipmap-xxhdpi', target: 'drawable-xxhdpi' },
  { source: 'mipmap-xxxhdpi', target: 'drawable-xxxhdpi' },
];

function copyFile(source, target) {
  try {
    // Ensure target directory exists
    const targetDir = path.dirname(target);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    // Copy the file
    fs.copyFileSync(source, target);
    console.log(`✓ Copied ${source} → ${target}`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to copy ${source} → ${target}:`, error.message);
    return false;
  }
}

function main() {
  console.log('🎯 Setting up Android notification icons...\n');
  
  let successCount = 0;
  let totalCount = 0;
  
  for (const { source: sourceDensity, target: targetDensity } of densityMappings) {
    const sourceFile = path.join(sourceBase, sourceDensity, 'ic_launcher_monochrome.png');
    const targetFile = path.join(targetBase, targetDensity, 'ic_notification.png');
    
    totalCount++;
    
    if (!fs.existsSync(sourceFile)) {
      console.warn(`⚠ Source file not found: ${sourceFile}`);
      continue;
    }
    
    if (copyFile(sourceFile, targetFile)) {
      successCount++;
    }
  }
  
  console.log(`\n📊 Results: ${successCount}/${totalCount} icons copied successfully`);
  
  if (successCount === totalCount) {
    console.log('✅ All notification icons set up successfully!');
    console.log('📱 The notification icons should now appear properly sized in the Android status bar.');
    console.log('🔄 You may need to rebuild your app for changes to take effect.');
  } else {
    console.log('❌ Some icons failed to copy. Please check the errors above.');
  }
}

if (require.main === module) {
  main();
}

module.exports = { main }; 