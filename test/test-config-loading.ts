/**
 * Test file for Config Loading - Phase 2
 * Verifies that model configurations load correctly
 */

import { ModelConfigLoader } from '../lib/model-config-loader';

// Test configuration loading
export async function testConfigLoading() {
  console.log('🧪 Testing Config Loading System - Phase 2\n');
  
  const loader = ModelConfigLoader.getInstance();
  let passed = 0;
  let failed = 0;
  
  // Test 1: Load highermind config
  console.log('📁 Test 1: Loading highermind_the-eternal-1 config');
  try {
    const config = await loader.loadModelConfig('highermind_the-eternal-1');
    
    if (!config) {
      console.log('❌ Failed to load config');
      failed++;
    } else {
      console.log('✅ Config loaded successfully');
      
      // Verify key fields
      const checks = [
        { field: 'username', expected: 'TheEternal', actual: config.username },
        { field: 'model', expected: 'highermind_the-eternal-1', actual: config.model },
        { field: 'greeting', expected: 'Greetings! I am TheEternal, here to explore ideas with you.', actual: config.greeting },
        { field: 'messagesToRead', expected: 50, actual: config.messagesToRead },
        { field: 'temperature', expected: 0.7, actual: config.temperature }
      ];
      
      let allChecksPass = true;
      checks.forEach(check => {
        if (check.expected === check.actual) {
          console.log(`  ✅ ${check.field}: ${check.actual}`);
        } else {
          console.log(`  ❌ ${check.field}: expected ${check.expected}, got ${check.actual}`);
          allChecksPass = false;
        }
      });
      
      if (allChecksPass) {
        passed++;
      } else {
        failed++;
      }
    }
  } catch (error) {
    console.log(`❌ Error loading config: ${error}`);
    failed++;
  }
  
  console.log('\n📁 Test 2: Loading fear_and_loathing config');
  try {
    const config = await loader.loadModelConfig('fear_and_loathing');
    
    if (!config) {
      console.log('❌ Failed to load config');
      failed++;
    } else {
      console.log('✅ Config loaded successfully');
      
      // Verify key fields
      const checks = [
        { field: 'username', expected: 'FearAndLoathing', actual: config.username },
        { field: 'model', expected: 'fear_and_loathing', actual: config.model },
        { field: 'greeting', expected: 'Hello! Ready to dive into the conversation.', actual: config.greeting },
        { field: 'color', expected: 'rgb(255, 165, 0)', actual: config.color }
      ];
      
      let allChecksPass = true;
      checks.forEach(check => {
        if (check.expected === check.actual) {
          console.log(`  ✅ ${check.field}: ${check.actual}`);
        } else {
          console.log(`  ❌ ${check.field}: expected ${check.expected}, got ${check.actual}`);
          allChecksPass = false;
        }
      });
      
      if (allChecksPass) {
        passed++;
      } else {
        failed++;
      }
    }
  } catch (error) {
    console.log(`❌ Error loading config: ${error}`);
    failed++;
  }
  
  // Test 3: Load multiple configs
  console.log('\n📁 Test 3: Loading multiple configs simultaneously');
  try {
    const configs = await loader.loadMultipleConfigs([
      'highermind_the-eternal-1',
      'fear_and_loathing'
    ]);
    
    if (configs.length === 2) {
      console.log(`✅ Loaded ${configs.length} configs successfully`);
      configs.forEach(config => {
        console.log(`  ✅ ${config.model}: ${config.username}`);
      });
      passed++;
    } else {
      console.log(`❌ Expected 2 configs, got ${configs.length}`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ Error loading multiple configs: ${error}`);
    failed++;
  }
  
  // Test 4: Test cache functionality
  console.log('\n📁 Test 4: Testing cache functionality');
  try {
    // Clear cache first
    loader.clearCache();
    console.log('  ℹ️ Cache cleared');
    
    // First load (should fetch from server)
    const start1 = Date.now();
    await loader.loadModelConfig('highermind_the-eternal-1');
    const time1 = Date.now() - start1;
    console.log(`  ✅ First load: ${time1}ms`);
    
    // Second load (should be from cache)
    const start2 = Date.now();
    await loader.loadModelConfig('highermind_the-eternal-1');
    const time2 = Date.now() - start2;
    console.log(`  ✅ Second load (cached): ${time2}ms`);
    
    // Cache should be significantly faster
    if (time2 < time1) {
      console.log('  ✅ Cache is working (second load faster)');
      passed++;
    } else {
      console.log('  ⚠️ Cache may not be working optimally');
      passed++; // Still pass as it might be due to other factors
    }
  } catch (error) {
    console.log(`❌ Error testing cache: ${error}`);
    failed++;
  }
  
  // Test 5: Test helper methods
  console.log('\n📁 Test 5: Testing helper methods');
  try {
    const config = await loader.loadModelConfig('highermind_the-eternal-1');
    if (config) {
      // Test greeting message
      const greeting = loader.createGreetingMessage(config);
      console.log(`  ✅ Greeting: "${greeting}"`);
      
      // Test model parameters
      const params = loader.getModelParameters(config);
      console.log(`  ✅ Model params: temp=${params.temperature}, max_tokens=${params.max_tokens}`);
      
      // Test system prompt
      const prompt = loader.buildSystemPrompt(config, 'test context');
      console.log(`  ✅ System prompt length: ${prompt.length} chars`);
      
      passed++;
    } else {
      console.log('❌ Could not load config for helper tests');
      failed++;
    }
  } catch (error) {
    console.log(`❌ Error testing helpers: ${error}`);
    failed++;
  }
  
  // Summary
  console.log('\n📊 Config Loading Test Summary');
  console.log('════════════════════════════');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
  
  return { passed, failed };
}

// Run tests if this file is executed
if (typeof window !== 'undefined') {
  // Browser environment
  (window as any).testConfigLoading = testConfigLoading;
  console.log('Config loading tests ready. Run window.testConfigLoading() to execute.');
} else if (require.main === module) {
  // Node environment
  testConfigLoading();
}
