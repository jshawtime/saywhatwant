# 227 - Iframe Sandbox Restrictions

**Date:** December 17, 2025  
**Status:** 📋 Reference Documentation  
**Tags:** #iframe #sandbox #security #downloads #troubleshooting

---

## Overview

When embedding saywhatwant.app inside an iframe (e.g., in HIGHERMIND-site), the `sandbox` attribute restricts what the embedded content can do. Missing permissions cause features to silently fail.

---

## The Problem

**Symptom:** "Save ALL" button doesn't download the txt file when saywhatwant is embedded in HIGHERMIND iframe. Works fine when accessing saywhatwant.app directly.

**Root Cause:** The iframe's `sandbox` attribute was missing `allow-downloads`.

---

## Sandbox Attribute Reference

The `sandbox` attribute enables an extra set of restrictions for the iframe content. When present, it blocks almost everything by default. You must explicitly allow each capability.

### Permissions We Use

```html
<iframe
  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-presentation allow-downloads"
  allow="autoplay *; fullscreen; microphone; camera; clipboard-write"
/>
```

| Permission | What it enables |
|------------|-----------------|
| `allow-scripts` | JavaScript execution |
| `allow-same-origin` | Access to same-origin APIs (localStorage, IndexedDB) |
| `allow-forms` | Form submission |
| `allow-popups` | window.open(), target="_blank" links |
| `allow-modals` | alert(), confirm(), prompt() |
| `allow-presentation` | Presentation API |
| `allow-downloads` | File downloads (blob URLs, anchor downloads) |

### The `allow` Attribute (Different from sandbox)

The `allow` attribute controls feature policies:

| Permission | What it enables |
|------------|-----------------|
| `autoplay *` | Video/audio autoplay |
| `fullscreen` | Fullscreen API |
| `microphone` | Microphone access |
| `camera` | Camera access |
| `clipboard-write` | Write to clipboard |

---

## Common Issues & Fixes

### Issue: Downloads Don't Work
**Symptom:** `a.click()` with `download` attribute does nothing
**Fix:** Add `allow-downloads` to sandbox

### Issue: localStorage/IndexedDB Not Working
**Symptom:** Storage APIs throw errors or return undefined
**Fix:** Add `allow-same-origin` to sandbox

### Issue: Clipboard Copy Fails
**Symptom:** `navigator.clipboard.writeText()` throws error
**Fix:** Add `clipboard-write` to `allow` attribute

### Issue: Videos Don't Autoplay
**Symptom:** Video plays muted or doesn't play at all
**Fix:** Add `autoplay *` to `allow` attribute (requires user gesture on parent)

### Issue: Popups Blocked
**Symptom:** `window.open()` returns null
**Fix:** Add `allow-popups` to sandbox

---

## Debugging Iframe Issues

### Step 1: Test Outside Iframe
Access the URL directly (not embedded). If it works there but not in iframe, it's a sandbox issue.

### Step 2: Check Console Errors
Look for errors like:
- `Blocked by sandbox`
- `SecurityError`
- `NotAllowedError`

### Step 3: Add Permission Incrementally
Start with minimal sandbox and add permissions one by one until the feature works.

---

## Files Modified for allow-downloads Fix

**HIGHERMIND-site/components/Layout/PermanentIframe.tsx:**
```typescript
sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-presentation allow-downloads"
```

**HIGHERMIND-site/components/ChatOverlay/ChatOverlay.tsx:**
```typescript
sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-presentation allow-downloads"
```

---

## Security Considerations

The sandbox attribute is a security feature. Only add permissions that are actually needed:

- **DO use sandbox** - It provides defense in depth
- **DON'T remove sandbox entirely** - That removes all restrictions
- **DON'T add allow-top-navigation** - Iframe could redirect parent page (unless needed)
- **DO audit permissions periodically** - Remove any that aren't used

---

## Related Docs

- 222-IFRAME-EMBED-OTHER-DOMAINS.md - Guide for embedding saywhatwant in other sites
- 224-HIGHERMIND-TABBED-LAYOUT-MIGRATION.md - Layout with permanent iframe

