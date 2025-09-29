#!/usr/bin/env node

/**
 * Script to automatically clear all data from the COMMENTS_KV namespace
 * This will delete all comments, cache, and counters without confirmation
 * 
 * Usage: node scripts/clear-kv-auto.js
 */

const { execSync } = require('child_process');

console.log('🗑️  Starting KV store cleanup (AUTO MODE)...\n');

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
  
  console.log('🔥 Deleting all keys (this will take a while)...');
  let deleted = 0;
  let failed = 0;
  
  // Process in batches to avoid overwhelming the system
  const BATCH_SIZE = 100;
  for (let i = 0; i < keys.length; i += BATCH_SIZE) {
    const batch = keys.slice(i, Math.min(i + BATCH_SIZE, keys.length));
    const batchPromises = batch.map((key, index) => {
      const keyIndex = i + index;
      process.stdout.write(`\rDeleting ${keyIndex + 1}/${keys.length}... (${Math.round((keyIndex + 1) / keys.length * 100)}%)`);
      
      try {
        execSync(`npx wrangler kv:key delete --binding COMMENTS_KV "${key.name}" --force`, { 
          encoding: 'utf-8',
          stdio: ['inherit', 'pipe', 'pipe'] // Suppress output
        });
        deleted++;
        return true;
      } catch (error) {
        failed++;
        return false;
      }
    });
  }
  
  console.log('\n');
  console.log('✅ KV cleanup complete!');
  console.log(`  - Deleted: ${deleted} keys`);
  if (failed > 0) {
    console.log(`  - Failed: ${failed} keys`);
  }
  
  console.log('\n💡 The KV store has been cleared.');
  console.log('   New comments will be stored in 9-digit color format.');
  console.log('   Old RGB format: "rgb(255, 20, 147)"');
  console.log('   New 9-digit format: "255020147"');
  
  process.exit(0);
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
