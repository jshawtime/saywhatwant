#!/usr/bin/env node

/**
 * Populate localStorage with KV data for immediate testing
 * Run this in the browser console or as a script
 */

// This script should be run in the browser console at http://localhost:3000

async function populateLocalStorage() {
  try {
    console.log('Fetching KV data...');
    
    // Fetch the exported data
    const response = await fetch('/kv-data-export.json');
    if (!response.ok) {
      throw new Error('Could not load kv-data-export.json. Make sure you ran npm run fetch-kv first.');
    }
    
    const data = await response.json();
    console.log(`Loaded ${data.comments.length} comments from KV export`);
    
    // Transform comments to match localStorage format
    const transformedComments = data.comments.map(comment => {
      // Generate a proper ID if missing
      const id = comment.id || `${comment.timestamp || Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      return {
        id: id,
        timestamp: new Date(comment.timestamp || Date.now()).toISOString(),
        username: comment.username || 'anonymous',
        text: comment.text || '',
        userColor: comment.userColor || `rgb(${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)})`,
        videoRef: comment.videoRef
      };
    });
    
    // Sort by timestamp (newest first)
    transformedComments.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    // Save to localStorage
    localStorage.setItem('sww-comments-local', JSON.stringify(transformedComments));
    
    console.log(`✅ Successfully populated localStorage with ${transformedComments.length} comments!`);
    console.log('Refresh the page to see the comments.');
    
    // Show sample
    console.log('\nSample comments:');
    transformedComments.slice(0, 3).forEach((c, i) => {
      console.log(`${i + 1}. @${c.username}: ${c.text.substring(0, 50)}...`);
    });
    
    return transformedComments;
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\nTo fix this:');
    console.log('1. Make sure you ran: npm run fetch-kv');
    console.log('2. Make sure the dev server is running: npm run dev');
    console.log('3. Try refreshing the page and running this again');
  }
}

// Auto-run if in browser
if (typeof window !== 'undefined') {
  populateLocalStorage().then(() => {
    console.log('\n🔄 Refresh the page to see the comments!');
  });
} else {
  console.log('This script must be run in the browser console.');
  console.log('Copy and paste the populateLocalStorage function and run it.');
}
