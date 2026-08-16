const fs = require('fs');
const path = require('path');

const archiverModule = require('archiver');
const archiver = typeof archiverModule === 'function' ? archiverModule : archiverModule.default;

const BUILD_DIR = fs.existsSync(path.join(__dirname, 'out')) 
  ? path.join(__dirname, 'out') 
  : path.join(__dirname, '.next');

const OUTPUT_DIR = path.join(__dirname, 'release');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'frontend-release.zip');

console.log('📦 Starting frontend packaging process...');
console.log(`📂 Source directory: ${BUILD_DIR}`);

if (!fs.existsSync(BUILD_DIR)) {
  console.error('❌ Build directory not found! Make sure "next build" completed successfully.');
  process.exit(1);
}

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const output = fs.createWriteStream(OUTPUT_FILE);
const archive = archiver('zip', {
  zlib: { level: 9 }
});

output.on('close', () => {
  console.log('----------------------------------------');
  console.log('✅ Frontend successfully zipped!');
  console.log(`📁 File location: ${OUTPUT_FILE}`);
  console.log(`📊 Total size: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
  console.log('----------------------------------------');
});

archive.on('error', (err) => {
  throw err;
});

archive.pipe(output);

archive.directory(BUILD_DIR, false);

if (fs.existsSync(path.join(__dirname, 'public'))) {
  archive.directory(path.join(__dirname, 'public'), 'public');
}

// Include the cPanel .htaccess at the zip ROOT (it must sit in public_html),
// so static uploads work out of the box — direct URL loads, SPA routing and
// the /api reverse proxy all depend on it.
const htaccessPath = path.join(__dirname, 'public', '.htaccess');
if (fs.existsSync(htaccessPath)) {
  archive.file(htaccessPath, { name: '.htaccess' });
}
if (fs.existsSync(path.join(__dirname, 'package.json'))) {
  archive.file(path.join(__dirname, 'package.json'), { name: 'package.json' });
}

archive.finalize();