# Cloudflare KV Data Import Guide

## Overview

Tools for fetching data from Cloudflare KV and importing it into IndexedDB for local development and testing.

## Data Fetched

Successfully fetched **54 comments** from Cloudflare KV with the following characteristics:

- **Unique users**: 19
- **Date range**: Sept 16, 2025 - Sept 21, 2025  
- **Top users**: anonymous (19), QUI (5), JSHAW (5), cloudflareco (5), notgod (4)
- **Average message length**: 41 characters
- **File size**: 13.5 KB

## Quick Start

### Step 1: Fetch Data from Cloudflare KV
```bash
npm run fetch-kv
```
This downloads all comments from the production KV storage and saves them to `kv-data-export.json`.

### Step 2: Import to IndexedDB
Open the import tool:
```
http://localhost:3000/import-kv-data.html
```

Then:
1. Click "Load from Server" to load the exported data
2. Review the data preview
3. Click "Import All Messages" to import into IndexedDB

### Step 3: Verify Import
Open the analysis tool:
```
http://localhost:3000/indexedDB-analysis.html
```

Check:
- Messages tab to see imported comments
- Filters tab to set up lifetime filters
- Tools tab for additional operations

## File Locations

- **Fetch Script**: `/scripts/fetch-kv-data.js`
- **Import Tool**: `/public/import-kv-data.html` 
- **Analysis Tool**: `/public/indexedDB-analysis.html`
- **Export File**: `/public/kv-data-export.json` (13.5 KB)

## API Details

- **Worker URL**: https://sww-comments.bootloaders.workers.dev
- **API Endpoint**: /api/comments
- **Batch Size**: 500 comments per request
- **Current Total**: 54 comments in production

## Data Structure

Each comment has the following structure:
```json
{
  "id": "1758019061179-t99pogl92",
  "text": "Test comment",
  "timestamp": 1758019061179,
  "userAgent": "curl/8.7.1"
}
```

Some comments also include:
- `username`: User's display name
- `userColor`: RGB color value
- `videoRef`: Associated video reference

## Import Process

The import tool:
1. Loads the JSON data file
2. Validates the data structure
3. Imports messages in batches of 100
4. Shows progress with visual feedback
5. Messages go to `messages_temp` store initially
6. Filter memory system will move matching messages to permanent storage

## Testing with Real Data

Now you have real production data in your local IndexedDB:

1. **Test Filter Memory**: Apply filters and see which messages get saved permanently
2. **Test 24-Hour Cleanup**: Messages in temp store will expire after 24 hours
3. **Test Storage Management**: Generate more test data to approach the 1 GB limit
4. **Test URL Filtering**: Use the imported usernames in URL filters

## Troubleshooting

### Import Failed?
- Check browser console for errors
- Verify IndexedDB is not full
- Try clearing IndexedDB first with the "Clear IndexedDB First" button

### Data Not Showing?
- Refresh the analysis tool page
- Check the Messages tab for both Temporary and Permanent stores
- Verify the import completed successfully

### Need Fresh Data?
Run `npm run fetch-kv` again to get the latest data from Cloudflare KV.

## Summary

You now have **54 real comments** from production loaded into your local IndexedDB for testing. The data includes messages from 19 different users over a 5-day period, providing a good dataset for testing the filter memory system, storage management, and URL filtering features.

---

*Data fetched: Monday, September 22, 2025*
