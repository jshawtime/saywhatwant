#!/usr/bin/env node

/**
 * Cloudflare Workers Setup Script for Say What Want
 * Automates deployment configuration for Workers platform
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.blue}═══ ${msg} ═══${colors.reset}\n`)
};

// Configuration storage
const config = {
  kvNamespaceId: '',
  workerUrl: '',
  r2PublicUrl: '',
  accountId: '',
  r2AccessKeyId: '',
  r2SecretAccessKey: ''
};

// Helper functions
function promptUser(question) {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise(resolve => {
    readline.question(`${colors.yellow}?${colors.reset} ${question}: `, answer => {
      readline.close();
      resolve(answer.trim());
    });
  });
}

function updateFile(filePath, searchPattern, replacement) {
  const fullPath = path.join(process.cwd(), filePath);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    content = content.replace(searchPattern, replacement);
    fs.writeFileSync(fullPath, content);
    return true;
  }
  return false;
}

function createEnvFile(envPath, content) {
  const fullPath = path.join(process.cwd(), envPath);
  fs.writeFileSync(fullPath, content);
  return fullPath;
}

async function checkWranglerLogin() {
  try {
    execSync('wrangler whoami', { stdio: 'pipe' });
    return true;
  } catch {
    log.warning('Not logged into Wrangler');
    log.info('Running: wrangler login');
    try {
      execSync('wrangler login', { stdio: 'inherit' });
      return true;
    } catch {
      return false;
    }
  }
}

async function createKVNamespace() {
  log.header('Creating KV Namespace');
  
  try {
    const output = execSync('wrangler kv:namespace create "COMMENTS_KV"', { 
      encoding: 'utf8',
      cwd: path.join(process.cwd(), 'workers')
    });
    
    // Extract namespace ID from output
    const idMatch = output.match(/id = "([^"]+)"/);
    if (idMatch) {
      config.kvNamespaceId = idMatch[1];
      log.success(`KV Namespace created with ID: ${config.kvNamespaceId}`);
      return true;
    }
  } catch (error) {
    if (error.toString().includes('already exists')) {
      log.warning('KV namespace already exists');
      config.kvNamespaceId = await promptUser('Enter existing KV namespace ID');
      return true;
    }
    log.error(`Failed to create KV namespace: ${error.message}`);
  }
  return false;
}

async function updateWranglerConfig() {
  log.header('Updating Wrangler Configurations');
  
  // Update workers/wrangler.toml for comments API
  const workersConfigPath = 'workers/wrangler.toml';
  const workersUpdated = updateFile(
    workersConfigPath,
    /id = "YOUR_KV_NAMESPACE_ID_HERE"/,
    `id = "${config.kvNamespaceId}"`
  );
  
  if (workersUpdated) {
    log.success('Updated workers/wrangler.toml with KV namespace ID');
  } else {
    log.error('Failed to update workers/wrangler.toml');
  }
  
  // Update root wrangler.toml for main site
  const mainConfigPath = 'wrangler.toml';
  let mainUpdated = false;
  
  if (fs.existsSync(path.join(process.cwd(), mainConfigPath))) {
    mainUpdated = updateFile(
      mainConfigPath,
      /id = "YOUR_KV_NAMESPACE_ID_HERE"/,
      `id = "${config.kvNamespaceId}"`
    );
    
    if (mainUpdated && config.workerUrl) {
      updateFile(
        mainConfigPath,
        /COMMENTS_WORKER_URL = "[^"]*"/,
        `COMMENTS_WORKER_URL = "${config.workerUrl}"`
      );
    }
    
    if (mainUpdated && config.r2PublicUrl) {
      updateFile(
        mainConfigPath,
        /R2_BUCKET_URL = "[^"]*"/,
        `R2_BUCKET_URL = "${config.r2PublicUrl}"`
      );
    }
    
    if (mainUpdated) {
      log.success('Updated main wrangler.toml configuration');
    }
  }
  
  return workersUpdated;
}

async function deployWorker() {
  log.header('Deploying Comments Worker');
  
  try {
    const output = execSync('wrangler deploy', {
      encoding: 'utf8',
      cwd: path.join(process.cwd(), 'workers'),
      stdio: 'pipe'
    });
    
    // Extract worker URL from output
    const urlMatch = output.match(/https:\/\/[^\s]+workers\.dev/);
    if (urlMatch) {
      config.workerUrl = urlMatch[0];
      log.success(`Worker deployed at: ${config.workerUrl}`);
      return true;
    }
  } catch (error) {
    log.error(`Failed to deploy worker: ${error.message}`);
  }
  return false;
}

async function setupR2Configuration() {
  log.header('R2 Configuration');
  
  log.info('Please set up R2 in the Cloudflare Dashboard:');
  log.info('1. Create bucket named: sww-videos');
  log.info('2. Enable public access');
  log.info('3. Create API token with Object Read & Write permissions');
  
  config.r2PublicUrl = await promptUser('Enter R2 public URL (e.g., https://pub-xxx.r2.dev)');
  config.accountId = await promptUser('Enter Cloudflare Account ID');
  config.r2AccessKeyId = await promptUser('Enter R2 Access Key ID');
  config.r2SecretAccessKey = await promptUser('Enter R2 Secret Access Key');
  
  return true;
}

async function createEnvironmentFiles() {
  log.header('Creating Environment Files');
  
  // Create .env for R2 manifest generation
  const envContent = `# R2 Configuration for manifest generation
R2_ACCOUNT_ID=${config.accountId}
R2_ACCESS_KEY_ID=${config.r2AccessKeyId}
R2_SECRET_ACCESS_KEY=${config.r2SecretAccessKey}
R2_BUCKET_NAME=sww-videos
R2_PUBLIC_URL=${config.r2PublicUrl}`;
  
  createEnvFile('.env', envContent);
  log.success('Created .env file');
  
  // Create .env.local for Next.js
  const envLocalContent = `# Next.js Environment Variables
NEXT_PUBLIC_COMMENTS_API=${config.workerUrl}/api/comments
NEXT_PUBLIC_R2_BUCKET_URL=${config.r2PublicUrl}`;
  
  createEnvFile('.env.local', envLocalContent);
  log.success('Created .env.local file');
  
  return true;
}

async function displayDeploymentSteps() {
  log.header('Final Deployment Steps');
  
  console.log('\nNow deploy the main site:\n');
  console.log(`${colors.yellow}1. Build the Next.js app:${colors.reset}`);
  console.log(`   ${colors.green}npm run build${colors.reset}\n`);
  
  console.log(`${colors.yellow}2. Deploy the main site to Workers:${colors.reset}`);
  console.log(`   ${colors.green}wrangler deploy${colors.reset}\n`);
  
  console.log(`${colors.yellow}Your deployment URLs will be:${colors.reset}`);
  console.log(`  Main site: ${colors.green}https://say-what-want.[YOUR-SUBDOMAIN].workers.dev${colors.reset}`);
  console.log(`  Comments API: ${colors.green}${config.workerUrl}${colors.reset}\n`);
  
  return true;
}

async function generateVideoManifest() {
  log.header('Video Manifest Generation');
  
  const generateManifest = await promptUser('Do you have videos in R2? (y/n)');
  
  if (generateManifest.toLowerCase() === 'y') {
    try {
      execSync('npm run manifest:generate', { stdio: 'inherit' });
      log.success('Video manifest generated');
    } catch (error) {
      log.warning('Failed to generate manifest - you can run "npm run manifest:generate" later');
    }
  } else {
    log.info('Skipping manifest generation - run "npm run manifest:generate" after uploading videos');
  }
  
  return true;
}

async function displaySummary() {
  log.header('Setup Complete!');
  
  console.log('\n🎉 Configuration Summary:\n');
  console.log(`KV Namespace ID: ${colors.green}${config.kvNamespaceId}${colors.reset}`);
  console.log(`Worker URL: ${colors.green}${config.workerUrl}${colors.reset}`);
  console.log(`R2 Public URL: ${colors.green}${config.r2PublicUrl}${colors.reset}`);
  
  console.log('\n📋 Next Steps:\n');
  console.log('1. Configure Cloudflare Pages with the settings shown above');
  console.log('2. Trigger a deployment in Cloudflare Pages');
  console.log('3. Visit your site at: https://say-what-want.pages.dev');
  
  console.log('\n🧪 Test Commands:\n');
  console.log(`  ${colors.yellow}curl ${config.workerUrl}/api/comments${colors.reset}`);
  console.log(`  ${colors.yellow}wrangler tail${colors.reset} (in workers directory)`);
  console.log(`  ${colors.yellow}wrangler kv:key list --binding COMMENTS_KV${colors.reset}`);
  
  return true;
}

// Main setup flow
async function main() {
  console.log(`
${colors.blue}╔══════════════════════════════════════════╗
║   Say What Want - Cloudflare Setup Tool   ║
╚══════════════════════════════════════════╝${colors.reset}
`);

  const steps = [
    { name: 'Check Wrangler Login', fn: checkWranglerLogin },
    { name: 'Create KV Namespace', fn: createKVNamespace },
    { name: 'Update Wrangler Config', fn: updateWranglerConfig },
    { name: 'Deploy Comments Worker', fn: deployWorker },
    { name: 'Setup R2', fn: setupR2Configuration },
    { name: 'Create Environment Files', fn: createEnvironmentFiles },
    { name: 'Generate Video Manifest', fn: generateVideoManifest },
    { name: 'Display Deployment Steps', fn: displayDeploymentSteps },
    { name: 'Show Summary', fn: displaySummary }
  ];
  
  for (const step of steps) {
    const result = await step.fn();
    if (!result && step.name !== 'Generate Video Manifest') {
      log.error(`Setup failed at: ${step.name}`);
      process.exit(1);
    }
  }
  
  log.success('\nSetup completed successfully! 🚀');
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    log.error(`Setup failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { main };
