/**
 * Test file for URL Enhancements - Phase 1
 * Run this to verify URL parameter parsing is working correctly
 */

import { URLEnhancementsManager } from '../lib/url-enhancements';

// Mock window.location for testing
const mockWindowLocation = (hash: string) => {
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'location', {
      value: {
        hash: hash,
        href: `https://saywhatwant.app/${hash}`
      },
      writable: true
    });
  }
};

// Test cases
const testCases = [
  {
    name: 'filteractive=true',
    url: '#filteractive=true',
    expected: {
      filterActive: true
    }
  },
  {
    name: 'filteractive=false with filters',
    url: '#filteractive=false&u=alice:255000000',
    expected: {
      filterActive: false,
      users: [{ username: 'alice', color: 'rgb(255, 0, 0)' }]
    }
  },
  {
    name: 'Single model',
    url: '#model=highermind_the-eternal-1',
    expected: {
      modelConfigs: [{ modelName: 'highermind_the-eternal-1', color: '', isRandom: false }]
    }
  },
  {
    name: 'Model with color',
    url: '#model=highermind_the-eternal-1:255000000',
    expected: {
      modelConfigs: [{ modelName: 'highermind_the-eternal-1', color: 'rgb(255, 0, 0)', isRandom: false }]
    }
  },
  {
    name: 'Model with random color',
    url: '#model=highermind_the-eternal-1:random',
    expected: {
      modelConfigs: [{ modelName: 'highermind_the-eternal-1', color: '', isRandom: true }],
      pendingRandomColors: [{
        type: 'model',
        modelName: 'highermind_the-eternal-1',
        originalParam: 'highermind_the-eternal-1:random'
      }]
    }
  },
  {
    name: 'Multiple models',
    url: '#model=highermind_the-eternal-1+fear_and_loathing',
    expected: {
      modelConfigs: [
        { modelName: 'highermind_the-eternal-1', color: '', isRandom: false },
        { modelName: 'fear_and_loathing', color: '', isRandom: false }
      ]
    }
  },
  {
    name: 'User initial state',
    url: '#uis=Alice:255000000',
    expected: {
      userInitialState: { username: 'Alice', color: 'rgb(255, 0, 0)' }
    }
  },
  {
    name: 'User with random color',
    url: '#uis=Bob:random',
    expected: {
      userInitialState: { username: 'Bob', color: 'pending' },
      pendingRandomColors: [{
        type: 'user',
        username: 'Bob',
        originalParam: 'Bob:random'
      }]
    }
  },
  {
    name: 'AI initial state',
    url: '#ais=Assistant:000255000',
    expected: {
      aiInitialState: { username: 'Assistant', color: 'rgb(0, 255, 0)' }
    }
  },
  {
    name: 'Complex combination',
    url: '#filteractive=true&model=highermind_the-eternal-1:random&uis=Alice:random&u=TheEternal:138043226',
    expected: {
      filterActive: true,
      modelConfigs: [{ modelName: 'highermind_the-eternal-1', color: '', isRandom: true }],
      userInitialState: { username: 'Alice', color: 'pending' },
      users: [{ username: 'TheEternal', color: 'rgb(138, 43, 226)' }],
      pendingRandomColors: 2 // Should have 2 random color requests
    }
  }
];

// Run tests
export function runURLEnhancementTests() {
  console.log('🧪 Running URL Enhancement Tests - Phase 1\n');
  
  const manager = URLEnhancementsManager.getInstance();
  let passed = 0;
  let failed = 0;
  
  testCases.forEach(testCase => {
    try {
      // Mock the URL
      mockWindowLocation(testCase.url);
      
      // Parse the URL
      const result = manager.parseEnhancedHash();
      
      // Check expected values
      let success = true;
      const errors: string[] = [];
      
      Object.entries(testCase.expected).forEach(([key, expectedValue]) => {
        const actualValue = (result as any)[key];
        
        // Special handling for pendingRandomColors (check length)
        if (key === 'pendingRandomColors' && typeof expectedValue === 'number') {
          if (!actualValue || actualValue.length !== expectedValue) {
            success = false;
            errors.push(`  ❌ ${key}: expected ${expectedValue} items, got ${actualValue?.length || 0}`);
          }
        }
        // Deep comparison for arrays and objects
        else if (JSON.stringify(actualValue) !== JSON.stringify(expectedValue)) {
          success = false;
          errors.push(`  ❌ ${key}: expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`);
        }
      });
      
      if (success) {
        console.log(`✅ ${testCase.name}`);
        passed++;
      } else {
        console.log(`❌ ${testCase.name}`);
        errors.forEach(error => console.log(error));
        failed++;
      }
      
    } catch (error) {
      console.log(`❌ ${testCase.name} - Error: ${error}`);
      failed++;
    }
  });
  
  // Test random color generation
  console.log('\n🎲 Testing Random Color Generation\n');
  
  try {
    // Generate some random colors
    const colors = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const color = manager.generateRandomColor();
      colors.add(color);
      
      // Verify format
      if (!/^rgb\(\d{1,3}, \d{1,3}, \d{1,3}\)$/.test(color)) {
        console.log(`❌ Invalid color format: ${color}`);
        failed++;
      }
    }
    
    // Check that colors are actually random (should have at least 8 unique colors out of 10)
    if (colors.size >= 8) {
      console.log(`✅ Random color generation (${colors.size} unique colors generated)`);
      passed++;
    } else {
      console.log(`❌ Random colors not random enough (only ${colors.size} unique)`);
      failed++;
    }
    
  } catch (error) {
    console.log(`❌ Random color generation failed: ${error}`);
    failed++;
  }
  
  // Test URL building
  console.log('\n🔨 Testing URL Building\n');
  
  try {
    const state = {
      filterActive: true,
      modelConfigs: [
        { modelName: 'test-model', color: 'rgb(255, 0, 0)', isRandom: false }
      ],
      userInitialState: { username: 'TestUser', color: 'rgb(0, 255, 0)' },
      aiInitialState: { username: 'TestAI', color: 'rgb(0, 0, 255)' },
      users: [],
      serverSideUsers: [],
      colors: [],
      searchTerms: [],
      words: [],
      negativeWords: [],
      wordRemove: [],
      videoPlaylist: [],
      videoPanel: null,
      from: null,
      to: null,
      timeFrom: null,
      timeTo: null,
      pendingRandomColors: []
    };
    
    const hash = manager.buildEnhancedHash(state);
    const expected = '#filteractive=true&model=test-model:255000000&uis=TestUser:000255000&ais=TestAI:000000255';
    
    if (hash === expected) {
      console.log(`✅ URL building works correctly`);
      passed++;
    } else {
      console.log(`❌ URL building failed`);
      console.log(`  Expected: ${expected}`);
      console.log(`  Got: ${hash}`);
      failed++;
    }
    
  } catch (error) {
    console.log(`❌ URL building failed: ${error}`);
    failed++;
  }
  
  // Summary
  console.log('\n📊 Test Summary');
  console.log('═══════════════');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
  
  return { passed, failed };
}

// Run tests if this file is executed directly
if (typeof window !== 'undefined') {
  // Browser environment
  (window as any).runURLTests = runURLEnhancementTests;
  console.log('URL Enhancement tests loaded. Run window.runURLTests() to execute.');
} else if (require.main === module) {
  // Node environment
  runURLEnhancementTests();
}
