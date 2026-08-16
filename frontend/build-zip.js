const fs = require('fs');
const path = require('path');

const archiverModule = require('archiver');
const createArchive = (format, options) => {
  if (typeof archiverModule === 'function') {
    return archiverModule(format, options);
  }
  if (archiverModule.default && typeof archiverModule.default === 'function') {
    return archiverModule.default(format, options);
  }
  if (format === 'zip' && archiverModule.ZipArchive) {
    return new archiverModule.ZipArchive(options);
  }
  throw new Error('Unsupported archiver module structure');
};

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
const archive = createArchive('zip', {
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

if (fs.existsSync(path.join(__dirname, 'package.json'))) {
  archive.file(path.join(__dirname, 'package.json'), { name: 'package.json' });
}

archive.finalize();