# 213: LM Studio Synthesis Endpoint – External Access Guide *(Archived)*

> **STATUS:** Superseded. We experimented with Cloudflare Access + service tokens and later abandoned that path. The authoritative instructions now live in `214-LM-STUDIO-DIRECT-ACCESS.md`.

This page is intentionally short so nobody follows the old workflow by mistake. Historical details (payloads, Access policies, etc.) were removed to avoid duplication.

## Where to Look Instead

- `214-LM-STUDIO-DIRECT-ACCESS.md` – how to hit `https://aientities.saywhatwant.app/v1/chat/completions` directly.
- `hm-server-deployment/AI-Bot-Deploy/src/index-do-simple.ts` – reference implementation (`generateSynthesis()`).
- `saywhatwant/scripts/tunnel-manager.sh` – health checks / restarts for the existing tunnel.

## Why This Exists

If you need context on the retired Cloudflare Access experiment (audit, post-mortem, etc.) reach out in Slack—otherwise use doc 214.

