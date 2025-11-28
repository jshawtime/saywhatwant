# 214: LM Studio Direct Access (No DO, No PM2)

**Audience:** External/internal projects that want to reuse the SayWhatWant LM Studio box (`10.0.0.100`) without touching the Durable Object queue or PM2 worker fleet.  
**Goal:** Provide the quickest, most reliable way to send prompts directly to the LM Studio inference server and read the response.

---

## 1. Context

| Component | SayWhatWant production | Other project requirement |
|-----------|-----------------------|---------------------------|
| Message ingestion | Cloudflare DO (`/api/comments`) + PM2 workers | Not needed |
| Queue / claim-next | Atomic message claiming via DO | Not needed |
| LM access | PM2 workers call LM Studio after DO work | Desired to call LM Studio **directly** |

So, instead of routing traffic through DO → PM2, other projects should simply hit the LM Studio HTTPS endpoint we already expose via Cloudflare Tunnel.

---

## 2. Endpoint Overview

- **Base URL:** `https://aientities.saywhatwant.app`
- **API path:** `/v1/chat/completions`
- **Protocol:** HTTPS (OpenAI-compatible JSON)
- **Backend:** LM Studio on `10.0.0.100` (currently runs **Mistral Small (Instruct)** as the “loaded-model”)
- **Auth:** None today. If we later add Cloudflare Access, we’ll publish the service-token headers, but for now it is a plain HTTPS endpoint.

### Quick health checks

```bash
# 1. Ensure the tunnel + LM Studio are up (HTTP 200 means healthy)
curl -s -o /dev/null -w "%{http_code}\n" https://aientities.saywhatwant.app/health

# 2. See which models LM Studio exposes through the tunnel
curl -s https://aientities.saywhatwant.app/v1/models | jq
```

If either command fails, run `saywhatwant/scripts/tunnel-manager.sh status` on 10.0.0.100 or ping the infra channel.

---

## 3. Request Template

```http
POST /v1/chat/completions HTTP/1.1
Host: aientities.saywhatwant.app
Content-Type: application/json

{
  "model": "loaded-model",
  "messages": [
    { "role": "system", "content": "You are a concise synthesizer." },
    { "role": "user", "content": "Summarize:\n- AI1: courage\n- AI2: patience" }
  ],
  "temperature": 1,
  "top_p": 0,
  "top_k": 40,
  "frequency_penalty": 1,
  "max_tokens": 600,
  "stream": false
}
```

**Notes**
- Keep `"model": "loaded-model"` so LM Studio always uses the currently loaded model. If/when we change the default model, everyone benefits automatically.
- All other parameters map 1:1 with LM Studio / OpenAI chat API.

---

## 4. Sample cURL

```bash
curl -X POST https://aientities.saywhatwant.app/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d @payload.json
```

Where `payload.json` contains the JSON from Section 3.

Expected response:

```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "choices": [
    {
      "index": 0,
      "finish_reason": "stop",
      "message": {
        "role": "assistant",
        "content": "..."
      }
    }
  ],
  "usage": {
    "prompt_tokens": 512,
    "completion_tokens": 180,
    "total_tokens": 692
  }
}
```

---

## 5. Error Handling & Timeouts

| Scenario | Status | What it means | Suggested action |
|----------|--------|---------------|------------------|
| LM Studio offline | `502` or `530` | Tunnel can’t reach `10.0.0.100:1234` | Ping us (check `tunnel-manager.sh status`) |
| Malformed payload | `400` | JSON invalid or missing fields | Fix payload |
| Timeout | client side | Large prompts can take up to 120 s | Set request timeout ≥ 600 s if you expect huge syntheses |
| Empty completion | `choices[0].message.content` empty | Model only produced `<think>` tags | Treat as “no answer”, retry with different params |

---

## 6. Verification Checklist

1. `curl https://aientities.saywhatwant.app/v1/models` (should list `loaded-model`).
2. Send a simple prompt via Section 4 cURL.
3. Confirm latency fits your UX needs (LM Studio typically returns in 5‑15 s for short prompts).

---

## 7. Integration Tips

- **Keep requests small:** Unlike DO + PM2, you’re on the front line. Respect the server by batching or rate-limiting yourself (target ≤ 2 req/sec sustained).
- **Log request IDs:** LM Studio returns an `id`. Log it to correlate with future debugging.
- **Plan for future auth:** If/when we add Cloudflare Access service tokens, we’ll reuse this doc—only the auth headers will change.

---

## 8. Related Files

- `hm-server-deployment/AI-Bot-Deploy/src/index-do-simple.ts` → See `generateSynthesis()` for the exact payload SWW uses.
- `saywhatwant/docs/213-LM-STUDIO-SYNTHESIS-ENDPOINT.md` → Archived experiment with Zero Trust (for reference only).

Use this doc whenever another project wants to consume the LM Studio inference endpoint without touching SayWhatWant’s Durable Object/PM2 architecture.

