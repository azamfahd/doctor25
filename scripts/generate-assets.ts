import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function generateAssets() {
  const svgPath = path.join(process.cwd(), 'public', 'app_icon.svg');
  const assetsDir = path.join(process.cwd(), 'assets');

  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir);
  }

  console.log('🚀 Generating PNG assets from SVG...');

  // Generate main icon (high res)
  await sharp(svgPath)
    .resize(1024, 1024)
    .png()
    .toFile(path.join(assetsDir, 'icon.png'));
    
  console.log('✅ Generated icon.png');

  // Generate splash screen background
  // We'll use a solid color background for splash or a blurred version of the icon
  await sharp({
    create: {
      width: 2732,
      height: 2732,
      channels: 4,
      background: { r: 15, g: 23, b: 42, alpha: 1 } // slate-900 (matches manifest theme)
    }
  })
    .composite([
      {
        input: await sharp(svgPath).resize(512, 512).toBuffer(),
        gravity: 'center'
      }
    ])
    .png()
    .toFile(path.join(assetsDir, 'splash.png'));
    
  console.log('✅ Generated splash.png');

  // Generate dark splash
  await sharp({
    create: {
      width: 2732,
      height: 2732,
      channels: 4,
      background: { r: 15, g: 23, b: 42, alpha: 1 }
    }
  })
    .composite([
      {
        input: await sharp(svgPath).resize(512, 512).toBuffer(),
        gravity: 'center'
      }
    ])
    .png()
    .toFile(path.join(assetsDir, 'splash-dark.png'));

  console.log('✅ Generated splash-dark.png');
}

generateAssets().catch(err => {
  console.error('❌ Failed to generate assets:', err);
  process.exit(1);
});
