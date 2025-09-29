#!/usr/bin/env node
/**
 * Test script for LM Studio Cluster
 * Tests connectivity and basic operations with your Mac Studios
 */

import chalk from 'chalk';
import { initializeCluster } from './modules/lmStudioCluster.js';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load your configuration
const configPath = join(__dirname, '..', 'config-aientities.json');
JSON.parse(readFileSync(configPath, 'utf-8')); // Just validate the config exists

// Test configuration for your two Mac Studios
const testConfig = {
  servers: [
    {
      ip: '10.0.0.102',
      port: 1234,
      name: 'Mac Studio 1',
      enabled: true,
      capabilities: {
        maxMemory: 128, // 128GB RAM
        supportedFormats: ['MLX', 'GGUF'] as ('MLX' | 'GGUF')[],
      },
    },
    {
      ip: '10.0.0.100',
      port: 1234,
      name: 'Mac Studio 2',
      enabled: true,
      capabilities: {
        maxMemory: 128, // 128GB RAM
        supportedFormats: ['MLX', 'GGUF'] as ('MLX' | 'GGUF')[],
      },
    },
  ],
  modelLoadTimeout: 120000,    // 2 minutes for model loading
  requestTimeout: 30000,        // 30 seconds for requests
  healthCheckInterval: 10000,   // Check health every 10 seconds
  maxRetries: 3,
  loadBalancingStrategy: 'model-affinity' as const,
  modelUnloadDelay: 300000,     // Keep models for 5 minutes
};

async function runTests() {
  console.log(chalk.blue.bold('\n🧪 LM Studio Cluster Test Suite\n'));
  console.log(chalk.gray('Testing with your two Mac Studios (256GB total RAM)\n'));

  // Initialize cluster
  console.log(chalk.yellow('1. Initializing cluster...'));
  const cluster = initializeCluster(testConfig);
  
  // Wait a moment for initialization
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 1: Health Check
  console.log(chalk.yellow('\n2. Testing server connectivity...'));
  const healthStatus = await cluster.pingAll();
  
  for (const [serverId, status] of healthStatus) {
    if (status.healthy) {
      console.log(chalk.green(`   ✓ ${serverId} - Online (${status.latency}ms latency)`));
      if (status.loadedModels && status.loadedModels.length > 0) {
        console.log(chalk.gray(`     Models loaded: ${status.loadedModels.join(', ')}`));
      }
    } else {
      console.log(chalk.red(`   ✗ ${serverId} - Offline`));
      console.log(chalk.gray(`     Error: ${status.error}`));
    }
  }

  // Test 2: Get cluster status
  console.log(chalk.yellow('\n3. Cluster Status:'));
  const clusterStatus = cluster.getStatus();
  console.log(chalk.cyan(`   Total Servers: ${clusterStatus.totalServers}`));
  console.log(chalk.cyan(`   Healthy Servers: ${clusterStatus.healthyServers}`));
  console.log(chalk.cyan(`   Total Memory: ${clusterStatus.totalMemory}GB`));
  console.log(chalk.cyan(`   Available Memory: ${clusterStatus.availableMemory}GB`));
  
  if (clusterStatus.loadedModels.length > 0) {
    console.log(chalk.cyan(`   Loaded Models: ${clusterStatus.loadedModels.join(', ')}`));
  }

  // Test 3: Server details
  console.log(chalk.yellow('\n4. Server Details:'));
  for (const server of clusterStatus.serverDetails) {
    console.log(chalk.blue(`   ${server.name} (${server.ip}):`));
    console.log(chalk.gray(`     Status: ${server.status}`));
    console.log(chalk.gray(`     Memory: ${server.memoryUsage}`));
    console.log(chalk.gray(`     Models: ${server.loadedModels.length > 0 ? server.loadedModels.join(', ') : 'none'}`));
    console.log(chalk.gray(`     Active Requests: ${server.requestsInFlight}`));
  }

  // Test 4: Find available server
  console.log(chalk.yellow('\n5. Testing load balancing...'));
  const availableServer = await cluster.getAvailableServer('highermind_the-eternal-1');
  
  if (availableServer) {
    console.log(chalk.green(`   ✓ Selected server: ${availableServer.name} (${availableServer.ip})`));
    console.log(chalk.gray(`     Strategy: model-affinity`));
    console.log(chalk.gray(`     Has model loaded: ${availableServer.loadedModels.has('highermind_the-eternal-1')}`));
  } else {
    console.log(chalk.red('   ✗ No available servers'));
  }

  // Test 5: Model loading simulation (only if servers are healthy)
  if (clusterStatus.healthyServers > 0) {
    console.log(chalk.yellow('\n6. Testing model management...'));
    
    // Get the first healthy server
    const healthyServer = cluster.getHealthyServers()[0];
    
    if (healthyServer) {
      console.log(chalk.gray(`   Testing on ${healthyServer.name}...`));
      
      try {
        // Check current models
        const currentModels = await cluster.getCurrentModels(healthyServer);
        console.log(chalk.cyan(`   Current models: ${currentModels.length > 0 ? currentModels.join(', ') : 'none'}`));
        
        // Try to ensure model is loaded (won't actually load if server is offline)
        console.log(chalk.gray(`   Ensuring highermind_the-eternal-1 is loaded...`));
        await cluster.ensureModelLoaded(healthyServer, 'highermind_the-eternal-1');
        console.log(chalk.green(`   ✓ Model ready on ${healthyServer.name}`));
      } catch (error: any) {
        console.log(chalk.yellow(`   ⚠ Model operation failed: ${error.message}`));
        console.log(chalk.gray(`     This is expected if LM Studio is not running`));
      }
    }
  }

  // Test 6: Simulate request routing
  console.log(chalk.yellow('\n7. Simulating request routing...'));
  
  try {
    const testRequest = {
      model: 'highermind_the-eternal-1',
      prompt: 'Hello, this is a test prompt',
      parameters: {
        temperature: 0.6,
        maxTokens: 100,
      },
    };

    console.log(chalk.gray('   Attempting to queue request...'));
    
    if (clusterStatus.healthyServers > 0) {
      // Don't actually send the request in test mode
      const server = await cluster.getAvailableServer(testRequest.model);
      if (server) {
        console.log(chalk.green(`   ✓ Request would be routed to: ${server.name}`));
      }
    } else {
      console.log(chalk.yellow('   ⚠ No healthy servers to route to'));
    }
  } catch (error: any) {
    console.log(chalk.red(`   ✗ Routing failed: ${error.message}`));
  }

  // Cleanup
  console.log(chalk.yellow('\n8. Shutting down cluster...'));
  cluster.shutdown();
  console.log(chalk.green('   ✓ Cluster shutdown complete'));

  // Summary
  console.log(chalk.blue.bold('\n📊 Test Summary:'));
  
  if (clusterStatus.healthyServers === 0) {
    console.log(chalk.yellow('\n⚠️  No servers are currently reachable.'));
    console.log(chalk.gray('   Please ensure LM Studio is running on both Mac Studios:'));
    console.log(chalk.gray('   1. Start LM Studio on 10.0.0.102'));
    console.log(chalk.gray('   2. Start LM Studio on 10.0.0.100'));
    console.log(chalk.gray('   3. Enable server mode in both (listen on 0.0.0.0:1234)'));
    console.log(chalk.gray('   4. Load your model (highermind_the-eternal-1)'));
  } else if (clusterStatus.healthyServers === 1) {
    console.log(chalk.yellow('\n⚠️  Only one server is reachable.'));
    console.log(chalk.gray('   One Mac Studio is offline or LM Studio is not running on it.'));
  } else {
    console.log(chalk.green('\n✅ Cluster is fully operational!'));
    console.log(chalk.gray(`   ${clusterStatus.healthyServers} servers online with ${clusterStatus.totalMemory}GB total RAM`));
  }

  console.log(chalk.blue.bold('\n🎉 Test complete!\n'));
}

// Run tests
runTests().catch(error => {
  console.error(chalk.red('\n❌ Test failed:'), error);
  process.exit(1);
});
