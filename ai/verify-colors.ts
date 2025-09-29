#!/usr/bin/env tsx

/**
 * Verify that AI bot configs are using 9-digit color format
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('🔍 Verifying AI Bot Color Formats...\n');

// Check config files
const configFiles = [
  'config-aientities.json',
  'config-highermind.json'
];

let hasRgbColors = false;

configFiles.forEach(file => {
  console.log(`📄 Checking ${file}:`);
  
  try {
    const configPath = join(__dirname, file);
    const configData = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configData);
    
    config.entities.forEach((entity: any) => {
      const isRgb = entity.color && entity.color.includes('rgb(');
      const is9Digit = entity.color && /^\d{9}$/.test(entity.color);
      
      if (isRgb) {
        console.log(`  ❌ ${entity.username}: ${entity.color} (RGB format - needs fixing!)`);
        hasRgbColors = true;
      } else if (is9Digit) {
        console.log(`  ✅ ${entity.username}: ${entity.color} (9-digit format)`);
      } else if (entity.color) {
        console.log(`  ⚠️  ${entity.username}: ${entity.color} (unknown format)`);
      }
    });
    
  } catch (error) {
    console.log(`  ❌ Error reading file: ${error}`);
  }
  
  console.log('');
});

// Summary
console.log('📊 Summary:');
if (hasRgbColors) {
  console.log('❌ Some entities still have RGB format colors!');
  console.log('   The AI bot needs to be restarted to load the new configs.');
  console.log('\n   Run: ./restart-bot.sh');
} else {
  console.log('✅ All entities are using 9-digit format!');
  console.log('   Make sure the AI bot has been restarted to use these configs.');
}

console.log('\n💡 To restart the AI bot with new configs:');
console.log('   1. Stop the current bot process');
console.log('   2. Run: npm run build');
console.log('   3. Run: npm start (or npm run dev)');
