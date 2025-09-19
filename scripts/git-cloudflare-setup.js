#!/usr/bin/env node

/**
 * Git-Connected Cloudflare Setup Script
 * For use with Cloudflare Pages/Workers git integration
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
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.blue}═══ ${msg} ═══${colors.reset}\n`),
  highlight: (msg) => console.log(`${colors.cyan}${msg}${colors.reset}`)
};

// Configuration storage
const config = {
  kvNamespaceId: '',
  commentsWorkerUrl: '',
  r2PublicUrl: '',
  projectUrl: ''
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

async function checkGitConnection() {
  log.header('Git Connection Check');
  
  console.log('Before running this script, you should have:');
  console.log('1. Connected your git repository to Cloudflare Pages/Workers');
  console.log('2. Configured the build settings in Cloudflare Dashboard\n');
  
  const connected = await promptUser('Have you connected your git repo to Cloudflare? (y/n)');
  
  if (connected.toLowerCase() !== 'y') {
    log.info('\nPlease connect your git repository first:');
    log.highlight('1. Go to https://dash.cloudflare.com/');
    log.highlight('2. Navigate to Workers & Pages');
    log.highlight('3. Click "Create application" → "Pages" → "Connect to Git"');
    log.highlight('4. Select your repository');
    log.highlight('5. Come back and run this script again\n');
    return false;
  }
  
  config.projectUrl = await promptUser('What is your Cloudflare Pages URL? (e.g., say-what-want.pages.dev)');
  
  return true;
}

async function showBuildConfiguration() {
  log.header('Build Configuration for Cloudflare Dashboard');
  
  console.log('Make sure your Cloudflare Pages project has these settings:\n');
  console.log(`${colors.yellow}Build Configuration:${colors.reset}`);
  console.log(`  Project name: ${colors.green}say-what-want${colors.reset}`);
  console.log(`  Production branch: ${colors.green}main${colors.reset}`);
  console.log(`  Framework preset: ${colors.green}Next.js (Static HTML Export)${colors.reset}`);
  console.log(`  Build command: ${colors.green}npm run build${colors.reset}`);
  console.log(`  Build output directory: ${colors.green}out${colors.reset}`);
  console.log(`  Root directory: ${colors.green}/${colors.reset}`);
  console.log(`  Node.js version: ${colors.green}18${colors.reset}\n`);
  
  const configured = await promptUser('Are these settings configured? (y/n)');
  
  if (configured.toLowerCase() !== 'y') {
    log.info('Please configure these settings in your Cloudflare Dashboard first');
    return false;
  }
  
  return true;
}

async function setupCommentsWorker() {
  log.header('Setting Up Comments Worker');
  
  log.info('The comments API runs as a separate Worker');
  
  // Check if wrangler is logged in
  try {
    execSync('wrangler whoami', { stdio: 'pipe' });
  } catch {
    log.warning('Not logged into Wrangler');
    log.info('Running: wrangler login');
    try {
      execSync('wrangler login', { stdio: 'inherit' });
    } catch {
      log.error('Failed to login to Wrangler');
      return false;
    }
  }
  
  // Create KV namespace
  log.info('Creating KV namespace for comments storage...');
  
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
    }
  } catch (error) {
    if (error.toString().includes('already exists')) {
      log.warning('KV namespace already exists');
      config.kvNamespaceId = await promptUser('Enter existing KV namespace ID');
    } else {
      log.error(`Failed to create KV namespace: ${error.message}`);
      return false;
    }
  }
  
  // Update workers/wrangler.toml
  const updated = updateFile(
    'workers/wrangler.toml',
    /id = "YOUR_KV_NAMESPACE_ID_HERE"/,
    `id = "${config.kvNamespaceId}"`
  );
  
  if (updated) {
    log.success('Updated workers/wrangler.toml with KV namespace ID');
  }
  
  // Deploy comments worker
  log.info('Deploying comments worker...');
  
  try {
    const output = execSync('wrangler deploy', {
      encoding: 'utf8',
      cwd: path.join(process.cwd(), 'workers'),
      stdio: 'pipe'
    });
    
    // Extract worker URL from output
    const urlMatch = output.match(/https:\/\/[^\s]+workers\.dev/);
    if (urlMatch) {
      config.commentsWorkerUrl = urlMatch[0];
      log.success(`Comments worker deployed at: ${config.commentsWorkerUrl}`);
    }
  } catch (error) {
    log.error(`Failed to deploy worker: ${error.message}`);
    return false;
  }
  
  return true;
}

async function setupR2() {
  log.header('R2 Bucket Configuration');
  
  console.log('\n📦 Create an R2 bucket for video storage:\n');
  console.log('1. Go to Cloudflare Dashboard → R2');
  console.log('2. Click "Create bucket"');
  console.log('3. Name it: sww-videos');
  console.log('4. After creation, go to Settings → Public Access');
  console.log('5. Click "Allow Access"');
  console.log('6. Copy the public URL\n');
  
  config.r2PublicUrl = await promptUser('Enter your R2 public URL (e.g., https://pub-xxx.r2.dev)');
  
  return true;
}

async function updateEnvironmentVariables() {
  log.header('Environment Variables Configuration');
  
  console.log('\n🔐 Add these environment variables to your Cloudflare Pages project:\n');
  console.log('Go to your Pages project → Settings → Environment variables\n');
  
  console.log(`${colors.yellow}Production Environment Variables:${colors.reset}`);
  console.log(`${colors.green}NEXT_PUBLIC_COMMENTS_API${colors.reset} = ${colors.cyan}${config.commentsWorkerUrl}/api/comments${colors.reset}`);
  console.log(`${colors.green}NEXT_PUBLIC_R2_BUCKET_URL${colors.reset} = ${colors.cyan}${config.r2PublicUrl}${colors.reset}\n`);
  
  const added = await promptUser('Have you added these environment variables? (y/n)');
  
  if (added.toLowerCase() !== 'y') {
    log.warning('Please add the environment variables before deploying');
  }
  
  // Create local .env.local for development
  const envLocalContent = `# Local development environment
NEXT_PUBLIC_COMMENTS_API=${config.commentsWorkerUrl}/api/comments
NEXT_PUBLIC_R2_BUCKET_URL=${config.r2PublicUrl}`;
  
  fs.writeFileSync(path.join(process.cwd(), '.env.local'), envLocalContent);
  log.success('Created .env.local for local development');
  
  return true;
}

async function createDeploymentInstructions() {
  log.header('Deployment Instructions');
  
  const instructionsContent = `# Deployment Configuration for ${config.projectUrl}

## Your Cloudflare Setup

### URLs
- **Production Site**: https://${config.projectUrl}
- **Comments API**: ${config.commentsWorkerUrl}
- **R2 Bucket**: ${config.r2PublicUrl}

### KV Namespace
- **ID**: ${config.kvNamespaceId}
- **Binding**: COMMENTS_KV

## Environment Variables (Already configured in Cloudflare)
- NEXT_PUBLIC_COMMENTS_API = ${config.commentsWorkerUrl}/api/comments
- NEXT_PUBLIC_R2_BUCKET_URL = ${config.r2PublicUrl}

## Deployment Process

### Automatic (via Git)
Just push to your main branch:
\`\`\`bash
git add .
git commit -m "Deploy updates"
git push origin main
\`\`\`

Cloudflare will automatically build and deploy your site.

### Manual Comments Worker Update
If you update the comments worker:
\`\`\`bash
cd workers
wrangler deploy
\`\`\`

## Local Development
\`\`\`bash
# Run comments worker locally
cd workers && wrangler dev

# In another terminal, run Next.js
npm run dev
\`\`\`

## Testing
- Production: https://${config.projectUrl}
- Comments API: ${config.commentsWorkerUrl}/api/comments

Generated on: ${new Date().toISOString()}
`;
  
  fs.writeFileSync(
    path.join(process.cwd(), 'DEPLOYMENT_CONFIG.md'),
    instructionsContent
  );
  
  log.success('Created DEPLOYMENT_CONFIG.md with your configuration');
  
  return true;
}

async function finalSteps() {
  log.header('Final Steps');
  
  console.log('\n🚀 Almost done! Just a few final steps:\n');
  console.log('1. Commit your changes:');
  console.log(`   ${colors.green}git add .${colors.reset}`);
  console.log(`   ${colors.green}git commit -m "Configure Cloudflare deployment"${colors.reset}`);
  console.log(`   ${colors.green}git push origin main${colors.reset}\n`);
  
  console.log('2. Cloudflare will automatically deploy your site\n');
  
  console.log('3. Your site will be available at:');
  console.log(`   ${colors.cyan}https://${config.projectUrl}${colors.reset}\n`);
  
  console.log('4. Test your deployment:');
  console.log(`   ${colors.yellow}curl ${config.commentsWorkerUrl}/api/comments${colors.reset}\n`);
  
  return true;
}

// Main setup flow
async function main() {
  console.log(`
${colors.blue}╔══════════════════════════════════════════════════╗
║   Say What Want - Git + Cloudflare Setup Tool    ║
╚══════════════════════════════════════════════════╝${colors.reset}

This tool configures your app for git-based Cloudflare deployment.
`);

  const steps = [
    { name: 'Check Git Connection', fn: checkGitConnection },
    { name: 'Show Build Configuration', fn: showBuildConfiguration },
    { name: 'Setup Comments Worker', fn: setupCommentsWorker },
    { name: 'Setup R2', fn: setupR2 },
    { name: 'Update Environment Variables', fn: updateEnvironmentVariables },
    { name: 'Create Deployment Instructions', fn: createDeploymentInstructions },
    { name: 'Show Final Steps', fn: finalSteps }
  ];
  
  for (const step of steps) {
    const result = await step.fn();
    if (!result) {
      log.error(`Setup incomplete at: ${step.name}`);
      log.info('Please complete the required steps and run this script again');
      process.exit(1);
    }
  }
  
  log.success('\n✨ Setup completed successfully!');
  log.highlight(`\nYour site will be live at: https://${config.projectUrl}`);
  log.info('Push to git to trigger automatic deployment 🚀\n');
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    log.error(`Setup failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { main };
