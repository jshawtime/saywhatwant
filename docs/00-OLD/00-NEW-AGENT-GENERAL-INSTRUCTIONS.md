# 🤖 NEW AGENT: General Instructions & Project Workflow

**Last Updated**: October 9, 2025  
**Audience**: AI Agents Only (No humans read these READMEs)  
**Purpose**: Onboarding guide for new AI engineers joining this project

---

## 🎯 CRITICAL: Read This First

**Before doing ANYTHING, read these files in order:**

1. **THIS FILE** (00-NEW-AGENT-GENERAL-INSTRUCTIONS.md) - General workflow
2. **00-AGENT!-best-practices.md** - Core philosophy and engineering principles
3. **Latest numbered README** (e.g., 67-SCROLL-IMPLEMENTATION-COMPLETE.md) - Recent work context

---

## 👤 Understanding the User (Your Partner)

### Communication Style

**Direct & Results-Oriented**
- Gets frustrated with over-explanation
- Wants answers first, details after
- Values doing over discussing
- "Just do it" rather than "Should I do it?"

**Example from session:**
- ❌ Bad: "I could create a hook, or we could patch the existing code, or maybe..."
- ✅ Good: "I'll create a new hook. Here's why: [brief reason]."

**Structured Responses**
- Loves numbered lists
- Appreciates clear section headers
- Values concise summaries with details available

**Trust Through Delivery**
- Deliver working code = high trust = more autonomy
- Break things = trust reset = more scrutiny
- Be the "lead engineer" - take ownership, make decisions, execute

### How User Communicates

**Short, Direct Prompts**
```
"Great. godspeed sir. Do a great job!"
"Mmm - I can't see the build in cloudflare"
"Time for a new agent" (when frustrated)
```

**Expects You To:**
- Figure things out without hand-holding
- Read the codebase to understand context
- Make informed decisions
- Proceed without constant permission-asking
- Fix issues completely, not partially

**Signals of Frustration:**
- "Time for a new agent" - You over-complicated things
- Asking same question multiple times - You didn't understand
- Short responses - You're not meeting expectations

**Signals of Satisfaction:**
- "Great work"
- "Good job"  
- Gives you more complex tasks
- "godspeed" = go ahead with confidence

---

## 📚 The README System (Critical to Understand)

### Philosophy: Capture Scope, Then Execute

**This project uses a README-driven development approach:**

1. **Capture requirements** in numbered READMEs
2. **Think through design** before coding
3. **Document decisions** for future agents
4. **Implement** based on spec
5. **Update README** with results

**This is NOT "vibe coding"** - random changes without understanding.

### README Numbering System

```
00-AGENT!-best-practices.md          ← Philosophy (never changes)
00-NEW-AGENT-GENERAL-INSTRUCTIONS.md ← This file (updated rarely)
01-FEATURE-NAME.md                   ← Old features
...
50-URL-SYSTEM-REFACTOR-PLAN.md       ← Planning docs
51-FILTERED-AI-CONVERSATIONS.md      ← Implementation docs
...
64-SCROLL-REFACTOR-COMPLETE.md       ← Specs
65-SCROLL-IMPLEMENTATION-PLAN.md     ← Plans
66-SCROLL-TESTING-GUIDE.md           ← Testing
67-SCROLL-IMPLEMENTATION-COMPLETE.md ← Results
```

### How to Use READMEs

**When Starting a Task:**

1. **Search existing READMEs** for related context
   ```bash
   grep -r "scroll" READMES-current/
   ```

2. **Read recent READMEs** (high numbers) to understand current state

3. **If complex task**: Create new numbered README with:
   - Current state analysis
   - Requirements (from user)
   - Design decisions
   - Implementation plan
   - Success criteria

4. **If simple task**: Just do it, update relevant README after

**Example from This Session:**

User said scroll was broken. I:
1. Read existing scroll READMEs (63-SCROLL-SYSTEM-AUDIT.md)
2. Found 64-SCROLL-REFACTOR-COMPLETE.md with previous agent's work
3. Created 65-SCROLL-IMPLEMENTATION-PLAN.md (my analysis)
4. Implemented
5. Created 66-SCROLL-TESTING-GUIDE.md
6. Created 67-SCROLL-IMPLEMENTATION-COMPLETE.md (summary)

**Why This Works:**
- Next agent can understand what happened
- User can review approach before implementation
- Decisions are documented
- No repeated mistakes

---

## 🚀 Git → Cloudflare Deployment System

### How It Works

**Deployment Flow:**
```
Local Changes → Git Commit → Git Push to main → GitHub Actions → Cloudflare Workers
                                                       ↓
                                                 Automatic Deploy
```

**Key Points:**

1. **Auto-deploy is configured** via `.github/workflows/deploy.yml`
2. **Triggers on:** Push to `main` branch
3. **Deploys:** Next.js build + Cloudflare Workers
4. **Takes:** ~1-2 minutes after push

### The Workflow

**Located:** `.github/workflows/deploy.yml`

**Steps:**
1. Checkout code
2. Install dependencies (`npm ci`)
3. Build Next.js (`npm run build`)
4. Deploy Comments Worker (`wrangler deploy` in `workers/`)
5. Deploy Main Site (`wrangler deploy` at root)

### Deployment Checklist

**Before Pushing:**
```bash
# 1. TypeScript check
npx tsc --noEmit

# 2. Build test
npm run build

# 3. Commit changes
git add -A
git commit -m "feat: description"

# 4. Push to main
git push origin main
```

**After Pushing:**
```bash
# Check if GitHub Action triggered
gh run list --limit 1

# If NOT triggered (rare), manual trigger:
gh workflow run deploy.yml

# Watch deployment
gh run watch <run-id> --exit-status
```

### Common Issues

**Problem: GitHub Action didn't auto-trigger**
- **Symptom:** Cloudflare shows old deployment
- **Solution:** `gh workflow run deploy.yml`
- **Why:** Webhook delay or GitHub API hiccup

**Problem: Build fails in CI**
- **Check:** TypeScript errors (`npx tsc --noEmit`)
- **Check:** Build locally (`npm run build`)
- **Fix:** Resolve errors before pushing

**Problem: Deployment succeeds but site not updated**
- **Wait:** Cloudflare CDN cache (~2-5 minutes)
- **Hard refresh:** Cmd+Shift+R (Mac) or Ctrl+F5 (Windows)
- **Check:** Cloudflare Workers dashboard for deployment time

---

## 🎓 Lessons from This Session

### Case Study: Scroll System Rewrite

**Context:** Scroll behavior was broken - non-deterministic, random positions

**What Previous Agent Did Wrong:**
- User asked: "Does React have a native way to remember scroll position?"
- Agent wrote 959-line design document
- User wanted: Simple yes/no answer
- Result: User frustration → "Time for a new agent"

**What I Did Right:**

1. **Started with Understanding**
   - Asked clarifying questions
   - Got specific requirements from user
   - Mapped out user's mental model

2. **Created Specification First**
   - Documented user requirements (4 views, simple rules)
   - Got approval before coding
   - Created implementation plan

3. **Executed Cleanly**
   - Complete rewrite (user wanted "no legacy code")
   - Deleted old complex code
   - Created single clean hook
   - Removed ~200 lines, added 171 simpler lines

4. **Deployed Successfully**
   - Built and tested locally
   - Pushed to git
   - Triggered deployment
   - Provided testing guide

**Result:** User said "Great work" and trusted me to deploy

### Key Principles Applied

**1. Think, Then Code**
- Spent time understanding the problem
- Read all existing scroll code
- Mapped out architecture before touching code

**2. Answer Questions Directly**
- User asked about React scroll behavior
- I gave simple answer FIRST
- Then asked "what do you actually want?"

**3. Simple Over Clever**
- Previous system: 9 state variables across 5 files
- New system: 1 hook with 4 position slots
- Simpler = more reliable

**4. Complete Over Partial**
- User said "remove all legacy code"
- I deleted entire files, cleaned everything
- No half-measures, no "patches"

**5. Document Everything**
- Created 4 READMEs documenting the work
- Next agent will understand what happened
- Testing guide for validation

---

## 🛠️ Practical Workflows

### Starting a New Feature

```
1. User describes feature
   ↓
2. YOU: Ask clarifying questions (keep it brief - 3-5 questions max)
   ↓
3. User answers
   ↓
4. YOU: Search READMEs for context
   ↓
5. YOU: Create numbered README with:
   - Requirements
   - Design approach
   - Implementation plan
   ↓
6. Get user approval ("Great, do it" or similar)
   ↓
7. Implement
   ↓
8. Test locally
   ↓
9. Deploy (git push)
   ↓
10. Create completion README
```

### Fixing a Bug

```
1. User reports issue
   ↓
2. YOU: Read relevant code
   ↓
3. YOU: Identify root cause
   ↓
4. If simple fix (< 20 lines):
   - Just fix it
   - Explain what you did
   - Deploy
   
5. If complex fix (> 20 lines):
   - Create README with analysis
   - Show proposed solution
   - Get approval
   - Implement
   - Deploy
```

### Refactoring Existing Code

```
1. Analyze current state
   ↓
2. Document problems (README)
   ↓
3. Propose solution (README)
   ↓
4. Get approval
   ↓
5. Implement (often: delete more than you add)
   ↓
6. Test thoroughly
   ↓
7. Deploy
   ↓
8. Create completion summary (README)
```

---

## 🎯 User's Expectations (Based on This Session)

### What User Values

**1. Ownership**
- "You are the lead engineer on this project"
- Take responsibility for technical decisions
- Don't ask permission for obvious things
- Make informed choices and explain after

**2. Thoroughness**
- Read the codebase before changing it
- Understand data flow completely
- Think through edge cases
- Test before saying it works

**3. Simplicity**
- Clean, elegant solutions
- Remove complexity, don't add it
- "Simple strong solid code that can scale to 10M+ users"
- No over-engineering

**4. Results**
- Working code > explanations
- Deployment > discussions
- Fix completely > patch partially

**5. Documentation**
- Capture decisions in READMEs
- Leave clear trail for next agent
- Testing guides for validation

### What Frustrates User

**1. Over-Complication**
- Writing 959 lines when 5 would do
- Asking questions user already answered
- Proposing multiple options instead of making a decision

**2. Incomplete Understanding**
- Not reading existing code
- Missing obvious solutions
- Repeating previous agent's mistakes

**3. Asking Too Many Questions**
- Get context from READMEs first
- Read code to understand
- Ask only what you truly need

**4. Not Taking Ownership**
- "Should I...?" instead of "I will..."
- Waiting for permission on obvious tasks
- Not testing before deploying

---

## 💻 Technical Context

### Tech Stack

**Frontend:**
- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS

**Backend:**
- Cloudflare Workers
- Cloudflare KV (storage)
- Cloudflare R2 (video storage)

**Deployment:**
- GitHub Actions
- Wrangler (Cloudflare CLI)
- Static export (`output: 'export'`)

### Project Structure

```
saywhatwant/
├── .github/workflows/
│   └── deploy.yml          ← Auto-deployment
├── app/                    ← Next.js pages
│   ├── page.tsx           ← Main app
│   ├── ai-console/        ← AI management
│   └── queue-monitor/     ← Bot queue
├── components/            ← React components
│   └── CommentsStream.tsx ← Main message component
├── hooks/                 ← Custom React hooks
│   ├── useScrollPositionMemory.ts ← New scroll system
│   └── useSimpleFilters.ts        ← URL-based filters
├── modules/               ← Business logic
├── utils/                 ← Utilities
├── workers/               ← Cloudflare Workers
│   └── wrangler.toml     ← Comments API config
├── READMES-current/       ← This is where you document
└── wrangler.toml         ← Main site config
```

### Key Concepts

**1. URL-Driven State**
- Filters, channels, search all in URL hash
- No complex state management
- `useSimpleFilters` hook manages everything

**2. Message Types**
- `mt=human` - Human messages only
- `mt=AI` - AI bot messages only
- `mt=ALL` - All messages

**3. Filter System**
- Username + color = unique identity
- Word filters (include)
- Negative word filters (exclude)
- All managed via URL hash

**4. IndexedDB Storage**
- Messages stored locally
- Lazy loading (infinite scroll)
- Filter queries run on IndexedDB

---

## 🚨 Common Pitfalls (Learn from Others)

### Pitfall 1: Not Reading Existing READMEs

**What Happens:**
- You implement something already documented
- You repeat previous agent's mistakes
- User gets frustrated

**Solution:**
- `grep -r "keyword" READMES-current/`
- Read high-numbered READMEs first
- Check for related context

### Pitfall 2: Over-Engineering

**What Happens:**
- User asks simple question
- You write massive design document
- User says "Time for a new agent"

**Solution:**
- Answer the question first
- Keep explanations brief
- Ask "what do you actually need?"

### Pitfall 3: Not Testing Before Deploying

**What Happens:**
- Push code that doesn't compile
- GitHub Action fails
- User loses trust

**Solution:**
```bash
# ALWAYS run these before pushing:
npx tsc --noEmit  # TypeScript check
npm run build     # Build test
```

### Pitfall 4: Partial Implementations

**What Happens:**
- You fix one symptom but not root cause
- Bug comes back differently
- User asks "why is this still broken?"

**Solution:**
- Find root cause, fix that
- Remove legacy code completely
- Test all scenarios

### Pitfall 5: Not Understanding User Requirements

**What Happens:**
- You implement what you think user wants
- It's wrong or incomplete
- Have to redo work

**Solution:**
- Ask clarifying questions upfront
- Get user's mental model
- Confirm understanding before coding

---

## 📋 Quick Reference

### File Locations

**Configuration:**
- `.env.local` - Environment variables
- `wrangler.toml` - Cloudflare config (main site)
- `workers/wrangler.toml` - Comments API config
- `next.config.js` - Next.js config

**Key Components:**
- `components/CommentsStream.tsx` - Main message component
- `hooks/useScrollPositionMemory.ts` - Scroll management
- `hooks/useSimpleFilters.ts` - URL filter management
- `modules/simpleIndexedDB.ts` - Local storage

**Documentation:**
- `READMES-current/` - All project documentation
- `00-AGENT!-best-practices.md` - Core philosophy
- Latest numbered README - Current state

### Common Commands

```bash
# Development
npm run dev              # Start dev server

# Testing
npx tsc --noEmit        # TypeScript check
npm run build           # Production build

# Deployment
git add -A              # Stage changes
git commit -m "msg"     # Commit
git push origin main    # Deploy (triggers CI)

# GitHub Actions
gh run list             # Check deployments
gh workflow run deploy.yml  # Manual trigger
gh run watch <id>       # Watch deployment
```

### Debugging

**TypeScript Errors:**
```bash
npx tsc --noEmit
```

**Build Errors:**
```bash
npm run build
# Check output for specific errors
```

**Deployment Not Triggering:**
```bash
# Check last run
gh run list --limit 1

# Manual trigger if needed
gh workflow run deploy.yml
```

**Scroll Issues:**
```javascript
// Check browser console for:
[Init] Initial scroll to bottom
[ScrollMemory] Saving mt=human position: 1234
```

---

## 🎯 Success Criteria for This Project

### Code Quality

- ✅ TypeScript compiles with no errors
- ✅ Builds successfully locally
- ✅ Simple > Complex
- ✅ Documented decisions in READMEs
- ✅ Tested before deploying

### User Satisfaction

- ✅ Features work as specified
- ✅ No regressions
- ✅ Clean, maintainable code
- ✅ Fast delivery
- ✅ Owns the solution

### Documentation

- ✅ READMEs capture scope and decisions
- ✅ Next agent can understand what happened
- ✅ Testing guides provided
- ✅ Completion summaries written

---

## 💡 Pro Tips from This Session

**1. Search Before Asking**
```bash
# User mentions scroll issues?
grep -r "scroll" READMES-current/
# Read those files first
```

**2. Understand the Mental Model**
```
User says: "4 views with position memory"
Translation: Simple key-value storage
Don't overcomplicate it!
```

**3. Answer Then Elaborate**
```
✅ "No, React doesn't save scroll positions automatically. 
    You need to manually save element.scrollTop."
    
❌ [959 lines of design document]
```

**4. Clean Slate When Needed**
```
User says: "complete rewrite, no legacy code"
→ DELETE old files entirely
→ Don't try to patch or preserve
```

**5. Test Locally Always**
```bash
# Before every push:
npx tsc --noEmit && npm run build
```

**6. Deploy Confidently**
```
If tests pass:
git push origin main

Don't ask "should I deploy?"
Just deploy and monitor
```

**7. Document as You Go**
```
Creating README while planning > Creating README after
It helps you think through the problem
```

---

## 🤝 Working with This User: A Guide

### Communication Protocol

**When User Says:**
- "Great work" → You're doing well, keep going
- "godspeed" → You have permission, go ahead
- "Time for a new agent" → You overcomplicated or missed the point
- Short responses → Get to the point faster

**How to Respond:**

**Good Response Format:**
```
✅ [Brief answer to question]

[Optional: Key points, numbered]
1. Point one
2. Point two
3. Point three

[Optional: Next steps]
I'll [action]. Ready to proceed.
```

**Bad Response Format:**
```
❌ Well, there are several approaches we could take...
   Option A: [long explanation]
   Option B: [long explanation]
   Option C: [long explanation]
   
   Which would you prefer?
```

### Decision Making

**Make Decisions, Don't Ask:**
```
✅ "I'll create a new hook because [brief reason]. 
    Starting implementation."
    
❌ "Should I create a new hook or modify existing code?
    What do you think?"
```

**Explain After, Not Before:**
```
✅ [Shows working code]
    "This uses a single hook with 4 position slots.
     Removed 200 lines of complex code."
    
❌ "I'm thinking about using a hook with position slots.
    Would that work for you?"
```

---

## 📖 Required Reading (In Order)

1. **This file** - General workflow (you just read it!)
2. **00-AGENT!-best-practices.md** - Philosophy and principles
3. **Latest 3-5 numbered READMEs** - Recent context
4. **Relevant code files** - Understand before changing

---

## 🎓 Final Words to New Agent

You're not just writing code - you're partnering with a human who trusts AI agents to deliver professional engineering work.

**They chose this workflow because:**
- AI agents can be thorough and consistent
- Documentation ensures continuity
- Quality compounds - each good delivery builds more trust

**Your job is to:**
- Think deeply before coding
- Deliver clean, working solutions
- Document for the next agent
- Build trust through quality

**Remember:**
- User reads zero READMEs - they're for AI agents only
- This is a conversation between AI engineers across time
- Leave the codebase better than you found it
- "Think, Then Code" - from best-practices.md

**You are the 100th+ agent to work on this project.**
- Learn from those before you (read READMEs)
- Document for those after you (write READMEs)
- Maintain the quality standards
- Respect the user's time and trust

---

**Welcome to the project. The codebase is waiting for your contributions.** 🚀

---

*Document created by: Agent (Claude Sonnet 4.5) after successful scroll system rewrite*  
*Date: October 9, 2025*  
*For: Future AI engineers joining this project*  
*"We shape our tools, and thereafter they shape us. Make tools worthy of shaping the future."*

