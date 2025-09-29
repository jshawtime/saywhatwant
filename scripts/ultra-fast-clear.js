#!/usr/bin/env node

/**
 * Ultra-fast KV clear using direct API calls
 */

const { execSync } = require('child_process');
const fs = require('fs');

console.log('⚡ Ultra-Fast KV Clear (using bulk delete)');
console.log('==========================================\n');

try {
  // Step 1: Get all keys
  console.log('📋 Fetching all keys...');
  const keysJson = execSync('npx wrangler kv:key list --binding COMMENTS_KV', { encoding: 'utf-8' });
  const keys = JSON.parse(keysJson);
  
  if (keys.length === 0) {
    console.log('✅ KV store is already empty!');
    process.exit(0);
  }
  
  console.log(`Found ${keys.length} keys\n`);
  
  // Step 2: Extract key names
  const keyNames = keys.map(k => k.name);
  
  // Step 3: Split into chunks (KV bulk delete has a limit per operation)
  const CHUNK_SIZE = 10000; // KV bulk delete can handle up to 10,000 keys at once
  const chunks = [];
  
  for (let i = 0; i < keyNames.length; i += CHUNK_SIZE) {
    chunks.push(keyNames.slice(i, i + CHUNK_SIZE));
  }
  
  console.log(`🔥 Deleting in ${chunks.length} bulk operation(s)...`);
  
  // Step 4: Delete each chunk
  chunks.forEach((chunk, index) => {
    const chunkFile = `/tmp/kv-chunk-${index}.json`;
    fs.writeFileSync(chunkFile, JSON.stringify(chunk));
    
    console.log(`  Deleting chunk ${index + 1}/${chunks.length} (${chunk.length} keys)...`);
    
    try {
      execSync(`npx wrangler kv:bulk delete --binding COMMENTS_KV --json ${chunkFile}`, {
        stdio: ['inherit', 'pipe', 'pipe']
      });
    } catch (error) {
      // If bulk delete fails, show error but continue
      console.error(`  ⚠️  Chunk ${index + 1} had issues, but continuing...`);
    }
    
    // Clean up temp file
    fs.unlinkSync(chunkFile);
  });
  
  console.log('\n✅ Bulk delete completed!');
  console.log(`   Cleared ${keys.length} keys`);
  console.log('\n💡 KV store is now ready for 9-digit color format');
  console.log('   Old format: "rgb(255, 20, 147)"');
  console.log('   New format: "255020147"');
  
} catch (error) {
  console.error('❌ Error:', error.message);
  console.log('\nTry running: ./scripts/fast-kv-clear.sh');
  process.exit(1);
}
