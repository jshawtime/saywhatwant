#!/usr/bin/env node

/**
 * Script to clear all data from the COMMENTS_KV namespace
 * This will delete all comments, cache, and counters
 * 
 * Usage: node scripts/clear-kv.js
 */

const { execSync } = require('child_process');

console.log('🗑️  Starting KV store cleanup...\n');

try {
  // Get all keys from KV
  console.log('📋 Fetching all keys from KV store...');
  const keysJson = execSync('npx wrangler kv:key list --binding COMMENTS_KV', { encoding: 'utf-8' });
  const keys = JSON.parse(keysJson);
  
  if (keys.length === 0) {
    console.log('✅ KV store is already empty!');
    process.exit(0);
  }
  
  console.log(`Found ${keys.length} keys to delete\n`);
  
  // Group keys by type for reporting
  const keyTypes = {
    comments: keys.filter(k => k.name.startsWith('comment:')),
    cache: keys.filter(k => k.name.startsWith('recent:')),
    counter: keys.filter(k => k.name === 'message-count'),
    rate: keys.filter(k => k.name.startsWith('rate:')),
    other: keys.filter(k => 
      !k.name.startsWith('comment:') && 
      !k.name.startsWith('recent:') && 
      !k.name.startsWith('rate:') &&
      k.name !== 'message-count'
    )
  };
  
  console.log('📊 Key breakdown:');
  console.log(`  - Comments: ${keyTypes.comments.length}`);
  console.log(`  - Cache: ${keyTypes.cache.length}`);
  console.log(`  - Counter: ${keyTypes.counter.length}`);
  console.log(`  - Rate limits: ${keyTypes.rate.length}`);
  console.log(`  - Other: ${keyTypes.other.length}`);
  console.log('');
  
  // Ask for confirmation
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  readline.question('⚠️  This will DELETE ALL DATA. Continue? (yes/no): ', (answer) => {
    if (answer.toLowerCase() !== 'yes') {
      console.log('❌ Cancelled');
      readline.close();
      process.exit(0);
    }
    
    console.log('\n🔥 Deleting all keys...');
    let deleted = 0;
    let failed = 0;
    
    // Delete each key
    keys.forEach((key, index) => {
      try {
        process.stdout.write(`\rDeleting ${index + 1}/${keys.length}... `);
        execSync(`npx wrangler kv:key delete --binding COMMENTS_KV "${key.name}"`, { 
          encoding: 'utf-8',
          stdio: ['inherit', 'pipe', 'pipe'] // Suppress output
        });
        deleted++;
      } catch (error) {
        failed++;
        console.error(`\n❌ Failed to delete key: ${key.name}`);
      }
    });
    
    console.log('\n');
    console.log('✅ KV cleanup complete!');
    console.log(`  - Deleted: ${deleted} keys`);
    if (failed > 0) {
      console.log(`  - Failed: ${failed} keys`);
    }
    
    console.log('\n💡 Note: The KV store is now empty.');
    console.log('   New comments will be stored in 9-digit color format.');
    
    readline.close();
    process.exit(0);
  });
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
