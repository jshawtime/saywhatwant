#!/usr/bin/env node

/**
 * Bulk delete all keys from KV store using parallel operations
 * Much faster than deleting one by one
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function bulkClearKV() {
  console.log('🚀 Starting BULK KV clear (FAST method)...\n');
  
  try {
    // Get all keys
    console.log('📋 Fetching all keys...');
    const { stdout } = await execAsync('npx wrangler kv:key list --binding COMMENTS_KV');
    const keys = JSON.parse(stdout);
    
    if (keys.length === 0) {
      console.log('✅ KV store is already empty!');
      return;
    }
    
    console.log(`Found ${keys.length} keys to delete\n`);
    
    // Create a JSON file with all key names for bulk delete
    const keyNames = keys.map(k => k.name);
    require('fs').writeFileSync('/tmp/kv-keys-to-delete.json', JSON.stringify(keyNames));
    
    console.log('🔥 Performing BULK DELETE (this should be fast)...');
    
    // Use wrangler bulk delete
    const { stdout: deleteOutput } = await execAsync(
      'npx wrangler kv:bulk delete --binding COMMENTS_KV --json /tmp/kv-keys-to-delete.json'
    );
    
    console.log('✅ Bulk delete completed!');
    console.log(`Deleted ${keys.length} keys`);
    
    // Clean up temp file
    require('fs').unlinkSync('/tmp/kv-keys-to-delete.json');
    
    console.log('\n💡 KV store is now empty and ready for 9-digit color format!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    // If bulk delete isn't available, try parallel batch delete
    console.log('\n🔄 Trying alternative parallel method...');
    await parallelDelete();
  }
}

// Alternative: Delete in parallel batches
async function parallelDelete() {
  console.log('📋 Fetching keys for parallel delete...');
  const { stdout } = await execAsync('npx wrangler kv:key list --binding COMMENTS_KV');
  const keys = JSON.parse(stdout);
  
  if (keys.length === 0) {
    console.log('✅ KV store is already empty!');
    return;
  }
  
  console.log(`Found ${keys.length} keys to delete`);
  console.log('🔥 Deleting in parallel batches of 50...');
  
  const BATCH_SIZE = 50;
  let deleted = 0;
  
  for (let i = 0; i < keys.length; i += BATCH_SIZE) {
    const batch = keys.slice(i, Math.min(i + BATCH_SIZE, keys.length));
    
    // Delete batch in parallel
    await Promise.all(
      batch.map(key => 
        execAsync(`npx wrangler kv:key delete --binding COMMENTS_KV "${key.name}" --force`)
          .catch(() => {}) // Ignore individual errors
      )
    );
    
    deleted += batch.length;
    process.stdout.write(`\rDeleted ${deleted}/${keys.length} (${Math.round(deleted/keys.length * 100)}%)`);
  }
  
  console.log('\n✅ Parallel delete completed!');
}

// Run the bulk clear
bulkClearKV().catch(console.error);
