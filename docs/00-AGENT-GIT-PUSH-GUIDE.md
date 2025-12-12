# Agent Guide: Pushing to GitHub

**Tags:** #agent-guide #git #github #deployment  
**Purpose:** General instructions for AI agents on how to push code changes to GitHub

---

## Overview

When you make code changes and the user wants them pushed to GitHub, follow this workflow. This is a general guide applicable to any project.

---

## Basic Git Workflow

### 1. Check Current Status

Always start by understanding the current state:

```bash
git status
```

This shows:
- Modified files (red = unstaged, green = staged)
- Untracked files (new files not yet added)
- Current branch

### 2. Stage Changes

Add files to the staging area:

```bash
# Stage specific files
git add path/to/file.ts

# Stage all changes in current directory
git add .

# Stage all changes in entire repo
git add -A
```

### 3. Commit Changes

Create a commit with a descriptive message:

```bash
git commit -m "Brief description of changes"
```

**Good commit messages:**
- `"Fix: resolve null pointer in auth handler"`
- `"Feature: add dark mode toggle to settings"`
- `"Refactor: simplify polling logic in useMessages hook"`

**Bad commit messages:**
- `"fix"` (too vague)
- `"updates"` (meaningless)
- `"WIP"` (not descriptive)

### 4. Push to Remote

```bash
# Push to current branch
git push

# Push to specific branch
git push origin main

# Push and set upstream (first push of a new branch)
git push -u origin feature-branch
```

---

## Cursor-Specific: Permissions

**IMPORTANT:** Git operations require the `git_write` permission in Cursor.

When running git commands that modify state, request the permission:

```
required_permissions: ["git_write"]
```

Commands that need `git_write`:
- `git add`
- `git commit`
- `git push`
- `git checkout`
- `git merge`
- `git reset`
- `git stash`

Commands that DON'T need `git_write` (read-only):
- `git status`
- `git log`
- `git diff`
- `git branch` (listing only)

---

## Complete Push Sequence

Here's a typical sequence to push changes:

```bash
# 1. Check what's changed
git status

# 2. Review the diff (optional but recommended)
git diff

# 3. Stage all changes
git add -A

# 4. Commit with message
git commit -m "Description of changes"

# 5. Push to remote
git push
```

**All in one command** (if you're confident):

```bash
git add -A && git commit -m "Description" && git push
```

---

## Common Scenarios

### Scenario 1: Simple Push (Most Common)

User says: "Push these changes"

```bash
git add -A && git commit -m "Implement feature X" && git push
```

### Scenario 2: Push to Specific Branch

```bash
git push origin develop
```

### Scenario 3: Create New Branch and Push

```bash
git checkout -b feature/new-feature
git add -A
git commit -m "Add new feature"
git push -u origin feature/new-feature
```

### Scenario 4: Pull Before Push (If Remote Has Changes)

If `git push` fails with "rejected" error:

```bash
git pull --rebase
git push
```

### Scenario 5: Check Remote URL

```bash
git remote -v
```

---

## Troubleshooting

### "Permission denied (publickey)"

The machine doesn't have SSH keys configured for GitHub. Ask the user to:
1. Check if SSH key exists: `ls ~/.ssh/id_*`
2. Add key to GitHub if needed
3. Or use HTTPS instead of SSH

### "rejected - non-fast-forward"

Remote has commits you don't have locally:

```bash
git pull --rebase
git push
```

### "nothing to commit, working tree clean"

No changes to commit. Either:
- Changes were already committed
- Files are in `.gitignore`
- No actual changes were made

### "fatal: not a git repository"

You're not in a git repo. Navigate to the project root:

```bash
cd /path/to/project
git status
```

---

## Best Practices for Agents

1. **Always check status first** - Understand what you're about to commit
2. **Use descriptive commit messages** - Future agents/humans will thank you
3. **Don't commit sensitive data** - Check for API keys, passwords, tokens
4. **Verify the branch** - Make sure you're on the right branch before pushing
5. **Request git_write permission** - Don't forget this in Cursor

---

## Quick Reference

| Action | Command |
|--------|---------|
| Check status | `git status` |
| Stage all | `git add -A` |
| Commit | `git commit -m "message"` |
| Push | `git push` |
| Pull | `git pull` |
| Current branch | `git branch --show-current` |
| Switch branch | `git checkout branch-name` |
| Create branch | `git checkout -b new-branch` |
| View log | `git log --oneline -10` |
| Discard changes | `git checkout -- file.txt` |
| Unstage | `git reset HEAD file.txt` |

---

## Example: Full Session

```bash
# Check what we're working with
git status
# On branch main
# Changes not staged for commit:
#   modified:   src/components/Header.tsx
#   modified:   src/hooks/useAuth.ts

# Stage everything
git add -A

# Commit with clear message
git commit -m "Fix: header auth state not updating on logout"

# Push to remote
git push
# Enumerating objects: 5, done.
# Writing objects: 100% (5/5), 1.2 KiB | 1.2 MiB/s, done.
# To github.com:user/repo.git
#    abc1234..def5678  main -> main
```

Done! Changes are now on GitHub.

