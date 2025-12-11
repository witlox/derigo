import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const srcDir = join(rootDir, 'src');
const distDir = join(rootDir, 'dist');
const dataDir = join(rootDir, 'data');

const isWatch = process.argv.includes('--watch');
const isProd = process.env.NODE_ENV === 'production';

// Get version: major.minor from package.json, patch from commit count
function getVersion() {
  const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'));
  const [major, minor] = pkg.version.split('.').slice(0, 2);

  let commitCount = '0';
  try {
    commitCount = execSync('git rev-list --count HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    // Not a git repo or git not available, use 0
    console.warn('Warning: Could not get git commit count, using 0');
  }

  return `${major}.${minor}.${commitCount}`;
}

// Ensure dist directories exist
const dirs = ['dist', 'dist/icons', 'dist/data'];
dirs.forEach(dir => {
  const path = join(rootDir, dir);
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
});

// Build configuration - use outfile for each entry to flatten output
const entries = [
  { in: join(srcDir, 'background/service-worker.ts'), out: join(distDir, 'service-worker.js') },
  { in: join(srcDir, 'content/content.ts'), out: join(distDir, 'content.js') },
  { in: join(srcDir, 'popup/popup.ts'), out: join(distDir, 'popup.js') },
  { in: join(srcDir, 'options/options.ts'), out: join(distDir, 'options.js') }
];

const commonOptions = {
  bundle: true,
  format: 'esm',
  target: 'chrome100',
  minify: isProd,
  sourcemap: !isProd,
  treeShaking: true,
  define: {
    'process.env.NODE_ENV': JSON.stringify(isProd ? 'production' : 'development')
  }
};

// Copy static files
function copyStaticFiles(version) {
  console.log('Copying static files...');

  // Copy manifest with updated version
  const manifest = JSON.parse(readFileSync(join(srcDir, 'manifest.json'), 'utf-8'));
  manifest.version = version;
  writeFileSync(join(distDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  // Copy HTML files
  const htmlFiles = ['popup/popup.html', 'options/options.html'];
  htmlFiles.forEach(file => {
    const src = join(srcDir, file);
    const dest = join(distDir, file.split('/').pop());
    if (existsSync(src)) {
      copyFileSync(src, dest);
    }
  });

  // Copy CSS files
  const cssFiles = ['content/styles.css', 'popup/popup.css', 'options/options.css'];
  cssFiles.forEach(file => {
    const src = join(srcDir, file);
    const dest = join(distDir, file.split('/').pop());
    if (existsSync(src)) {
      copyFileSync(src, dest);
    }
  });

  // Copy data files from data/ directory
  const dataFiles = ['keywords.json', 'sources.json'];
  dataFiles.forEach(file => {
    const src = join(dataDir, file);
    const dest = join(distDir, 'data', file);
    if (existsSync(src)) {
      copyFileSync(src, dest);
    }
  });

  // Copy data files from src/data/ directory
  const srcDataFiles = ['known-actors.json'];
  srcDataFiles.forEach(file => {
    const src = join(srcDir, 'data', file);
    const dest = join(distDir, 'data', file);
    if (existsSync(src)) {
      copyFileSync(src, dest);
    }
  });

  // Copy icons
  const iconSizes = ['16', '48', '128'];
  iconSizes.forEach(size => {
    const src = join(rootDir, 'icons', `icon${size}.png`);
    const dest = join(distDir, 'icons', `icon${size}.png`);
    if (existsSync(src)) {
      copyFileSync(src, dest);
    }
  });

  console.log('Static files copied.');
}

async function build() {
  try {
    const version = getVersion();
    console.log(`Building version ${version} in ${isProd ? 'production' : 'development'} mode...`);

    // Build each entry point separately to flatten output
    for (const entry of entries) {
      await esbuild.build({
        ...commonOptions,
        entryPoints: [entry.in],
        outfile: entry.out
      });
    }

    copyStaticFiles(version);
    console.log(`Build complete! Version: ${version}`);

    if (isWatch) {
      console.log('Watch mode not yet implemented for flattened output');
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
