#!/usr/bin/env node

/**
 * Fetch all comments from Cloudflare KV
 * Saves to a JSON file for local testing
 */

const fs = require('fs').promises;
const path = require('path');

// API configuration
const API_URL = 'https://sww-comments.bootloaders.workers.dev/api/comments';
const OUTPUT_FILE = path.join(__dirname, '..', 'kv-data-export.json');
const BATCH_SIZE = 500; // Fetch in batches

async function fetchComments(offset = 0, limit = BATCH_SIZE) {
  try {
    const url = `${API_URL}?offset=${offset}&limit=${limit}`;
    console.log(`Fetching from: ${url}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Failed to fetch at offset ${offset}:`, error.message);
    return { comments: [], hasMore: false };
  }
}

async function fetchAllComments() {
  console.log('Starting to fetch all comments from Cloudflare KV...');
  console.log(`API: ${API_URL}`);
  console.log('-----------------------------------');
  
  let allComments = [];
  let offset = 0;
  let hasMore = true;
  let batchCount = 0;
  
  while (hasMore) {
    batchCount++;
    console.log(`\nFetching batch ${batchCount} (offset: ${offset})...`);
    
    const data = await fetchComments(offset, BATCH_SIZE);
    
    if (data.comments && data.comments.length > 0) {
      allComments = allComments.concat(data.comments);
      console.log(`  ✓ Fetched ${data.comments.length} comments`);
      console.log(`  Total so far: ${allComments.length}`);
      
      // Check if there are more comments
      hasMore = data.hasMore !== false && data.comments.length === BATCH_SIZE;
      offset += BATCH_SIZE;
      
      // Small delay to avoid rate limiting
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } else {
      hasMore = false;
      console.log('  No more comments to fetch');
    }
  }
  
  return allComments;
}

async function saveToFile(comments) {
  try {
    // Create export object with metadata
    const exportData = {
      source: 'Cloudflare KV',
      exportDate: new Date().toISOString(),
      totalComments: comments.length,
      api: API_URL,
      comments: comments
    };
    
    // Save to file
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(exportData, null, 2));
    
    // Calculate file size
    const stats = await fs.stat(OUTPUT_FILE);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    console.log(`\n✅ Successfully saved to: ${OUTPUT_FILE}`);
    console.log(`   File size: ${fileSizeMB} MB`);
    
    // Show sample of data structure
    if (comments.length > 0) {
      console.log('\n📊 Sample comment structure:');
      console.log(JSON.stringify(comments[0], null, 2).split('\n').slice(0, 10).join('\n') + '...');
    }
    
    return OUTPUT_FILE;
  } catch (error) {
    console.error('Failed to save file:', error);
    throw error;
  }
}

async function analyzeComments(comments) {
  console.log('\n📈 Data Analysis:');
  console.log('-----------------------------------');
  
  if (comments.length === 0) {
    console.log('No comments to analyze');
    return;
  }
  
  // Get unique users
  const users = new Set(comments.map(c => c.username || 'anonymous'));
  console.log(`Unique users: ${users.size}`);
  
  // Get date range
  const timestamps = comments.map(c => new Date(c.timestamp).getTime()).filter(t => !isNaN(t));
  if (timestamps.length > 0) {
    const oldest = new Date(Math.min(...timestamps));
    const newest = new Date(Math.max(...timestamps));
    console.log(`Date range: ${oldest.toLocaleString()} to ${newest.toLocaleString()}`);
  }
  
  // Message length stats
  const lengths = comments.map(c => (c.text || '').length);
  const avgLength = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
  const maxLength = Math.max(...lengths);
  console.log(`Average message length: ${avgLength} chars`);
  console.log(`Longest message: ${maxLength} chars`);
  
  // Top 5 users
  const userCounts = {};
  comments.forEach(c => {
    const user = c.username || 'anonymous';
    userCounts[user] = (userCounts[user] || 0) + 1;
  });
  
  const topUsers = Object.entries(userCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  console.log('\nTop 5 users:');
  topUsers.forEach(([user, count]) => {
    console.log(`  ${user}: ${count} messages`);
  });
}

async function main() {
  try {
    console.log('🚀 Cloudflare KV Data Fetcher');
    console.log('==============================\n');
    
    // Fetch all comments
    const comments = await fetchAllComments();
    
    console.log('\n-----------------------------------');
    console.log(`✅ Total comments fetched: ${comments.length}`);
    
    if (comments.length === 0) {
      console.log('\n⚠️  No comments found in KV storage');
      console.log('   The KV storage might be empty or the API might be down');
      return;
    }
    
    // Analyze the data
    await analyzeComments(comments);
    
    // Save to file
    const outputPath = await saveToFile(comments);
    
    console.log('\n-----------------------------------');
    console.log('🎉 Export complete!\n');
    console.log('Next steps:');
    console.log('1. The data has been saved to kv-data-export.json');
    console.log('2. Open http://localhost:3000/indexedDB-analysis.html');
    console.log('3. Go to the "Tools" tab');
    console.log('4. Use "Import Database" to load this data');
    console.log('\nOr use the import script: npm run import-kv-data');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}
