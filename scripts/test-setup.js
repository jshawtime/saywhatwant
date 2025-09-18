#!/usr/bin/env node

/**
 * Test Setup Script for Say What Want
 * Verifies that all components are properly configured
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('\n🔍 Say What Want - Setup Verification\n');
console.log('=====================================\n');

let errors = 0;
let warnings = 0;

// Check Node version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
if (majorVersion < 18) {
  console.error('❌ Node.js version 18+ required. Current:', nodeVersion);
  errors++;
} else {
  console.log('✅ Node.js version:', nodeVersion);
}

// Check if package.json exists
const packageJsonPath = path.join(rootDir, 'package.json');
if (fs.existsSync(packageJsonPath)) {
  console.log('✅ package.json found');
} else {
  console.error('❌ package.json not found');
  errors++;
}

// Check if node_modules exists
const nodeModulesPath = path.join(rootDir, 'node_modules');
if (fs.existsSync(nodeModulesPath)) {
  console.log('✅ Dependencies installed (node_modules exists)');
} else {
  console.warn('⚠️  Dependencies not installed. Run: npm install');
  warnings++;
}

// Check for environment configuration
const envPath = path.join(rootDir, '.env.local');
const envExamplePath = path.join(rootDir, 'env.example');
if (fs.existsSync(envPath)) {
  console.log('✅ .env.local configured');
  
  // Check for required variables
  const envContent = fs.readFileSync(envPath, 'utf8');
  if (!envContent.includes('NEXT_PUBLIC_COMMENTS_API')) {
    console.warn('⚠️  NEXT_PUBLIC_COMMENTS_API not set in .env.local');
    warnings++;
  }
  if (!envContent.includes('NEXT_PUBLIC_R2_BUCKET_URL')) {
    console.warn('⚠️  NEXT_PUBLIC_R2_BUCKET_URL not set in .env.local');
    warnings++;
  }
} else if (fs.existsSync(envExamplePath)) {
  console.warn('⚠️  .env.local not found. Copy env.example to .env.local and configure');
  warnings++;
} else {
  console.error('❌ No environment configuration found');
  errors++;
}

// Check for worker configuration
const wranglerPath = path.join(rootDir, 'workers', 'wrangler.toml');
if (fs.existsSync(wranglerPath)) {
  console.log('✅ Wrangler configuration found');
  
  const wranglerContent = fs.readFileSync(wranglerPath, 'utf8');
  if (wranglerContent.includes('YOUR_KV_NAMESPACE_ID_HERE')) {
    console.warn('⚠️  KV namespace ID not configured in wrangler.toml');
    warnings++;
  }
} else {
  console.error('❌ workers/wrangler.toml not found');
  errors++;
}

// Check for video manifest
const manifestPath = path.join(rootDir, 'public', 'cloudflare', 'video-manifest.json');
if (fs.existsSync(manifestPath)) {
  console.log('✅ Video manifest found');
  
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    console.log(`   └─ ${manifest.videos.length} videos configured`);
  } catch (e) {
    console.error('❌ Video manifest is invalid JSON');
    errors++;
  }
} else {
  console.warn('⚠️  Video manifest not found (using demo videos)');
  warnings++;
}

// Check for required directories
const requiredDirs = ['app', 'components', 'workers', 'scripts', 'public'];
requiredDirs.forEach(dir => {
  const dirPath = path.join(rootDir, dir);
  if (fs.existsSync(dirPath)) {
    console.log(`✅ Directory: ${dir}/`);
  } else {
    console.error(`❌ Missing directory: ${dir}/`);
    errors++;
  }
});

// Check for key components
const components = [
  'app/page.tsx',
  'app/layout.tsx',
  'app/globals.css',
  'components/VideoPlayer.tsx',
  'components/CommentsStream.tsx',
  'workers/comments-worker.js'
];

console.log('\n📦 Component Files:');
components.forEach(file => {
  const filePath = path.join(rootDir, file);
  if (fs.existsSync(filePath)) {
    console.log(`   ✅ ${file}`);
  } else {
    console.error(`   ❌ Missing: ${file}`);
    errors++;
  }
});

// Summary
console.log('\n=====================================\n');
if (errors === 0 && warnings === 0) {
  console.log('✅ All checks passed! Ready to run:\n');
  console.log('   npm run dev        - Start development server');
  console.log('   npm run worker:dev - Start worker locally');
  console.log('   npm run build      - Build for production\n');
} else {
  if (errors > 0) {
    console.error(`❌ ${errors} error(s) found. Please fix these issues.\n`);
  }
  if (warnings > 0) {
    console.warn(`⚠️  ${warnings} warning(s) found. Consider addressing these.\n`);
  }
  
  console.log('📚 Next steps:');
  if (!fs.existsSync(nodeModulesPath)) {
    console.log('   1. Run: npm install');
  }
  if (!fs.existsSync(envPath)) {
    console.log('   2. Copy env.example to .env.local and configure');
  }
  if (wranglerPath && fs.readFileSync(wranglerPath, 'utf8').includes('YOUR_KV_NAMESPACE_ID_HERE')) {
    console.log('   3. Create KV namespace: wrangler kv:namespace create "COMMENTS_KV"');
    console.log('   4. Update wrangler.toml with the namespace ID');
  }
  console.log('\n📖 See README.md and DEPLOYMENT.md for detailed instructions.\n');
}

process.exit(errors > 0 ? 1 : 0);
