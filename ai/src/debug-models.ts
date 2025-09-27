#!/usr/bin/env node
/**
 * Debug script to understand what each server reports
 */

import fetch from 'node-fetch';
import chalk from 'chalk';

const servers = [
  { ip: '10.0.0.102', port: 1234, name: 'Mac Studio 1' },
  { ip: '10.0.0.100', port: 1234, name: 'Mac Studio 2' }
];

async function checkServer(server: { ip: string; port: number; name: string }) {
  console.log(chalk.blue(`\n========================================`));
  console.log(chalk.blue(`${server.name} (${server.ip}:${server.port})`));
  console.log(chalk.blue(`========================================`));
  
  try {
    // Check /v1/models endpoint
    const modelsResponse = await fetch(`http://${server.ip}:${server.port}/v1/models`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (modelsResponse.ok) {
      const data = await modelsResponse.json() as any;
      console.log(chalk.green('\n✓ Models Endpoint Response:'));
      console.log('  Raw data:', JSON.stringify(data, null, 2));
      
      if (data.data && Array.isArray(data.data)) {
        console.log(chalk.yellow('\n📦 Models reported by server:'));
        data.data.forEach((model: any) => {
          console.log(`  - ${model.id}`);
          if (model.object) console.log(`    Type: ${model.object}`);
          if (model.created) console.log(`    Created: ${new Date(model.created * 1000).toISOString()}`);
          if (model.owned_by) console.log(`    Owned by: ${model.owned_by}`);
        });
      }
    }
    
    // Try to get more info about loaded vs available
    console.log(chalk.yellow('\n🔍 Attempting to get server state...'));
    
    // Try different endpoints that might give us info
    const endpoints = [
      '/v1/models/loaded',  // Hypothetical endpoint
      '/api/models',        // Alternative endpoint
      '/models',            // Simple endpoint
      '/status',            // Status endpoint
      '/api/status'         // Alternative status
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`http://${server.ip}:${server.port}${endpoint}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        
        if (response.ok) {
          console.log(chalk.green(`  ✓ ${endpoint} returned data`));
          const data = await response.json();
          console.log(`    Response:`, JSON.stringify(data, null, 2).substring(0, 200));
        } else if (response.status !== 404) {
          console.log(chalk.yellow(`  ⚠ ${endpoint} returned ${response.status}`));
        }
      } catch (e) {
        // Silently skip
      }
    }
    
  } catch (error: any) {
    console.log(chalk.red('✗'), `Connection failed:`, error.message);
  }
}

async function main() {
  console.log(chalk.cyan('================================='));
  console.log(chalk.cyan('LM Studio Model State Debug'));
  console.log(chalk.cyan('================================='));
  
  for (const server of servers) {
    await checkServer(server);
  }
  
  console.log(chalk.cyan('\n================================='));
  console.log(chalk.cyan('Analysis:'));
  console.log(chalk.cyan('================================='));
  console.log('\nThe /v1/models endpoint appears to show:');
  console.log('- On 10.0.0.100: All AVAILABLE models (can be loaded)');
  console.log('- On 10.0.0.102: Only LOADED model (currently in memory)');
  console.log('\nThis inconsistency needs investigation in LM Studio settings.');
}

main().catch(console.error);
