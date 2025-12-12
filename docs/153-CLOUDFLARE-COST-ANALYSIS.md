# 153: Cloudflare Cost Analysis - Memory-Only Architecture

**Tags:** #cost #cloudflare #durable-objects #workers #scaling #economics  
**Created:** November 1, 2025  
**Updated:** November 30, 2025 - Memory-only architecture (Doc 220)  
**Status:** ✅ CURRENT - Post memory-only optimization

---

## 💰 MEMORY-ONLY COSTS: 1,000 Users @ 20 Messages/Day

**Total Monthly Cost: ~$10** (dramatically reduced from $28.88)

**User Activity:**
- 1,000 users
- 20 human messages per user per day
- 20 AI replies per user per day  
- **1,200,000 total messages/month**

**Cost Breakdown:**
- Storage Reads: **$0** (memory-only)
- Storage Writes: **$0** (memory-only)
- Storage (disk): **$0** (memory-only)
- Compute: $0.89 (71k GB-seconds)
- DO Requests: $8.25 (55M requests)
- Workers: Included in DO requests

**Per-User Economics:**
- **$0.01 per user per month** ($0.12/year)
- **$0.000008 per message**
- **125,000 messages per dollar**

---

## 🎯 Quick Reference

| Users | Monthly Cost | Cost/User/Month | Messages/Dollar |
|-------|--------------|-----------------|-----------------|
| 1K | ~$10 | $0.01 | 125,000 |
| 5K | ~$50 | $0.01 | 125,000 |
| 10K | ~$100 | $0.01 | 125,000 |
| 50K | ~$500 | $0.01 | 125,000 |
| 100K | ~$1,000 | $0.01 | 125,000 |

**Perfect linear scaling - cost per message stays constant!**

---

## Memory-Only Architecture (Doc 220)

### How It Works

1. **Frontend** stores all messages in IndexedDB (browser)
2. **Frontend** sends last 200 messages as context with each new message
3. **DO** stores messages in memory only (no persistent storage)
4. **Bot** uses context from message directly (no storage fetch)

### Why This Works

| Principle | Implementation |
|-----------|---------------|
| Real-time app | Memory is instant |
| "Tab closed = miss out" | No server history needed |
| Browser is source of truth | IndexedDB stores everything |
| Ephemeral by design | DO hibernation is acceptable |

### Cost Impact

| Operation | Before (Storage) | After (Memory) |
|-----------|------------------|----------------|
| POST message | 2 writes | 0 |
| Claim message | 1 read + 1 write | 0 |
| Fetch context | N reads | 0 |
| Complete message | 1 read + 1 write | 0 |
| **Per message pair** | **4+N reads, 6 writes** | **0** |

**Storage operations eliminated entirely.**

---

## Cloudflare Pricing

### Durable Objects

**Requests:** $0.15 per million
- Every POST, GET, claim, complete = 1 DO request
- In-memory operations (fast, atomic)

**Compute Duration:** $12.50 per million GB-seconds
- Measured while DO is processing
- Minimal for our simple operations (~10ms per request)

**Storage Operations:** $1.00 per million
- **NOW $0** - memory-only architecture

**Storage:** $0.20 per GB-month
- **NOW $0** - memory-only architecture

### Cloudflare Pages

**Frontend Hosting:** FREE
- Unlimited bandwidth
- Global CDN
- SSL included

---

## Cost Breakdown - 1 Million Human Messages/Month

### DO Requests ($0.15 per million)

**Message Operations:**
- Human POST: 1M requests
- AI POST: 1M requests
- Claim: 1M requests
- Complete: 1M requests
- **Total: 4M requests**

**Polling:**
- Frontend: ~50M requests (1000 users × ~1.2 polls/min × 43,200 min)
- Bot: ~0.9M requests (20 polls/min × 43,200 min)
- **Total: ~51M requests**

**Total DO Requests:** ~55M
**Cost:** 55M × $0.15/M = **$8.25/month**

### DO Compute Duration ($12.50 per million GB-seconds)

- 55M requests × 0.01s × 0.125 GB = ~69K GB-seconds
- **Cost:** 0.069M × $12.50 = **$0.86/month**

### Storage Operations & Storage

- **Cost: $0** (memory-only)

### Total Monthly Cost

| Service | Cost |
|---------|------|
| DO Requests | $8.25 |
| DO Compute | $0.86 |
| DO Storage Ops | $0 |
| DO Storage | $0 |
| **TOTAL** | **~$9.11/month** |

**Cost per message: $0.000009** (9 millionths of a dollar)

---

## Scaling Analysis

| Scale | Users | Messages | DO Cost | Per Message |
|-------|-------|----------|---------|-------------|
| 1x | 1K | 1M | $9.11 | $0.000009 |
| 10x | 10K | 10M | $91.10 | $0.000009 |
| 100x | 100K | 100M | $911.00 | $0.000009 |
| 1000x | 1M | 1B | $9,110.00 | $0.000009 |

**Perfect linear scaling!**

---

## ROI Analysis

### At 1M messages/month (1K users)

| Conversion | Purchases | Revenue | Cost | Profit | Margin |
|------------|-----------|---------|------|--------|--------|
| 0.5% | 5 | $50 | $9.11 | $40.89 | 82% |
| 1% | 10 | $100 | $9.11 | $90.89 | 91% |
| 2% | 20 | $200 | $9.11 | $190.89 | 95% |

**Breakeven:** Need only 1 sale per month ($10 product) to cover costs.

---

## Comparison: Before vs After Memory-Only

| Metric | Before (Storage) | After (Memory) | Savings |
|--------|------------------|----------------|---------|
| Monthly cost (1K users) | $28.88 | $9.11 | 68% |
| Storage reads/message | 4 + N | 0 | 100% |
| Storage writes/message | 6 | 0 | 100% |
| Cost per message | $0.000024 | $0.000009 | 63% |
| Messages per dollar | 41,667 | 111,111 | 167% more |

---

## Hidden Value (Included FREE)

**Cloudflare Pages:**
- Unlimited bandwidth
- Global CDN
- SSL certificates
- DDoS protection

**Workers + DOs:**
- Auto-scaling
- Global distribution
- Zero DevOps

---

## Summary

| Metric | Value |
|--------|-------|
| **Architecture** | Memory-only DO |
| **Monthly Cost (1K users)** | ~$9/month |
| **Per Message** | $0.000009 |
| **Messages/Dollar** | 111,111 |
| **Storage Operations** | 0 |
| **Storage Cost** | $0 |
| **Scaling** | Perfect linear |

---

**Status:** Current production architecture  
**Last Updated:** November 30, 2025  
**Architecture:** Memory-only Durable Objects (Doc 220)
