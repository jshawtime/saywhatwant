#!/usr/bin/env node

/**
 * FINAL Ultra-fast KV clear using correct bulk delete syntax
 * This will clear 12,000+ keys in seconds, not hours!
 */

const { execSync } = require('child_process');
const fs = require('fs');

console.log('⚡ KV Bulk Clear - FAST METHOD');
console.log('===============================\n');

try {
  // Step 1: Get all keys
  console.log('📋 Fetching all keys from KV...');
  const keysJson = execSync('npx wrangler kv:key list --binding COMMENTS_KV', { encoding: 'utf-8' });
  const keys = JSON.parse(keysJson);
  
  if (keys.length === 0) {
    console.log('✅ KV store is already empty!');
    process.exit(0);
  }
  
  console.log(`Found ${keys.length} keys to delete\n`);
  
  // Step 2: Extract key names only
  const keyNames = keys.map(k => k.name);
  
  // Step 3: Split into chunks (KV bulk delete limit is 10,000 per operation)
  const CHUNK_SIZE = 10000;
  const chunks = [];
  
  for (let i = 0; i < keyNames.length; i += CHUNK_SIZE) {
    chunks.push(keyNames.slice(i, i + CHUNK_SIZE));
  }
  
  console.log(`🔥 Deleting in ${chunks.length} chunk(s) of up to ${CHUNK_SIZE} keys each...\n`);
  
  let totalDeleted = 0;
  
  // Step 4: Delete each chunk with CORRECT syntax
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkFile = `/tmp/kv-bulk-delete-${i}.json`;
    
    // Write chunk as JSON array
    fs.writeFileSync(chunkFile, JSON.stringify(chunk));
    
    console.log(`  📦 Chunk ${i + 1}/${chunks.length}: Deleting ${chunk.length} keys...`);
    
    try {
      // CORRECT SYNTAX: filename first, then options
      execSync(`npx wrangler kv:bulk delete ${chunkFile} --binding COMMENTS_KV --force`, {
        stdio: 'inherit'
      });
      
      totalDeleted += chunk.length;
      console.log(`  ✅ Chunk ${i + 1} deleted successfully!\n`);
      
    } catch (error) {
      console.error(`  ❌ Error deleting chunk ${i + 1}: ${error.message}\n`);
    }
    
    // Clean up temp file
    if (fs.existsSync(chunkFile)) {
      fs.unlinkSync(chunkFile);
    }
  }
  
  console.log('=============================');
  console.log(`✅ Bulk delete completed!`);
  console.log(`   Deleted ${totalDeleted} keys`);
  
  // Verify deletion
  console.log('\n🔍 Verifying...');
  const remainingKeysJson = execSync('npx wrangler kv:key list --binding COMMENTS_KV', { encoding: 'utf-8' });
  const remainingKeys = JSON.parse(remainingKeysJson);
  console.log(`   ${remainingKeys.length} keys remaining`);
  
  if (remainingKeys.length === 0) {
    console.log('\n🎉 SUCCESS! KV store is completely empty!');
  }
  
  console.log('\n💡 New comments will use 9-digit color format:');
  console.log('   Old format: "rgb(255, 20, 147)"');
  console.log('   New format: "255020147"');
  
} catch (error) {
  console.error('❌ Fatal error:', error.message);
  process.exit(1);
}
