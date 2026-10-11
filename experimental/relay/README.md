# Relay — a Jev layout-engine demo (experimental, separate from the extension)

A fictional LLM-API-gateway landing page ("Relay") that reshapes itself around whoever is
reading it, using Jev (TypeSafe's System One model) purely as a **layout engine** — never as
a content generator. Jev can only answer typed yes/no probability questions (`noul`), so this
demo decomposes "which cards show, how prominent, which framing, which deep-dive leads" into a
batch of `noul` questions and maps the probabilities straight to layout.

This is intentionally **separate from the IntentLink Chrome extension** in this repo. It does
not touch `manifest.json`, `content.js`, `background.js`, or `adapters/`, and is not loaded by
the extension.

## Run it

Requires the repo root's `.env` to already have `JEV_API_KEY` set (same file the extension
uses via `scripts/gen-config.mjs`).

```sh
node experimental/relay/server.mjs
# → Relay demo running at http://localhost:8787
```

Open `http://localhost:8787`. The server does two things:
- Serves the static files in this folder.
- Proxies `POST /jev` to `https://api.typesafe.ai/v1/systemone`, injecting the API key
  server-side — the key never reaches the browser.

## The deck

- `cards.js` — **22 Features** cards shared by every reader, covering the breadth a real
  LLM-gateway marketing site would have: unified API, routing & fallback, latency, streaming/
  tool calls, OSS catalog, SDKs, pricing, spend analytics, budget controls, volume discounts,
  reliability/SLA, compliance, multi-modal input, fine-tuning & embeddings, batch API,
  observability/tracing, team workspaces & SSO, usage alerts, data residency, BYOK provider
  keys, enterprise support, and API versioning. Each has a neutral `summary` (what Jev scores)
  and a `dev` / `finance` framing variant of the same fact.
- `spotlight.js` — **5 Spotlight** deep-dive panels with hyper-specific, hand-written payloads:
  - `oss-commands` — exact curl/Python snippets for calling open-weight models (Llama, Mixtral,
    Qwen, DeepSeek) through the gateway, in general.
  - `deepseek-tutorial` — a hyper-specific tutorial for a developer who wants *DeepSeek*
    specifically: `deepseek-chat` (V3) vs `deepseek-reasoner` (R1), the R1-only
    `reasoning_content` field, and DeepSeek-specific notes (ignored sampling params on R1,
    prompt caching passthrough).
  - `reliability-playbook` — an exact pre-launch runbook: the API call that sets a provider
    fallback chain, raises a burst rate limit, and wires a latency alert — a concrete
    demonstration of the routing feature, not just a description of it.
  - `pricing-breakdown` — an exact per-token pricing table plus a worked monthly-bill
    comparison against per-seat Claude Code / Cursor pricing (illustrative figures, labeled as
    such — not a real benchmark from Anthropic or Cursor).
  - `compliance-dive` — SOC2/procurement checklist.

Nothing in either file is written or rewritten by Jev. All text is static.

### Why the example intents are scenarios, not keywords

The hero's example chips are deliberately **abstract scenarios** ("Finance pinged me about
last month's AI bill", "Legal won't let us sign until they see our data handling story") rather
than restatements of a card's title ("I want to use open-source models" → the open-source
catalog card). A query that echoes the card text proves keyword matching, not reasoning — the
demo only shows Jev's actual value when the intent and the card summary share no vocabulary and
the relevance link has to be inferred.

## The Jev question schema

One batched `POST /jev` per debounced keystroke. For N feature cards and M spotlight panels,
the request looks like:

```jsonc
{
  "model": "jev-latest",
  "state": { "intent": "...", "questionCount": "..." },
  "questions": {
    "<cardId>:rel":            { "type": "noul", "instructions": "Is this feature relevant or appealing to this reader? ..." },
    "<cardId>:conflict":       { "type": "noul", "instructions": "Is this feature irrelevant or off-putting to this reader? ..." },
    "<cardId>:var:dev":        { "type": "noul", "instructions": "Does this framing fit how this reader thinks about the product? ..." },
    "<cardId>:var:finance":    { "type": "noul", "instructions": "..." },
    "spot:<panelId>:rel":      { "type": "noul", "instructions": "Is this deep-dive exactly what this reader is asking for right now? ..." }
  }
}
```

`engine.js` reads back `data.answers[key].noul` and maps probabilities to layout:

| Signal | Meaning |
|---|---|
| `<cardId>:rel` | prominence band: `>=0.85` hero, `0.6–0.85` standard, `0.3–0.6` compact, `<0.3` dropped |
| `<cardId>:conflict` | `>=0.6` demotes the card a band (hero→standard) or drops it |
| `<cardId>:var:<id>` | argmax across variants picks the framing (dev vs finance copy) |
| `spot:<panelId>:rel` | argmax across panels picks the lead Spotlight deep-dive |

These thresholds mirror the extension's own Jev engine (`engines/jev.js`'s `KEEP_THRESHOLD`
and `content.js`'s `ll-keep`/`ll-maybe` bands), split into one more tier for a 4-band layout.

## Try it

There's no example-chip UI on the page anymore — the hero is just the input box. To demo,
either type an intent live, or use **`demo-links.md`**: five ready-made links in the same
`#ll-intent=` IntentLink format the main repo's `demo/test-links.md` uses. The page reads the
hash on load, fills the box, and fires the same Jev call a keystroke would — so a link is just
a bookmarked keystroke, not a different code path.

Toggle "Show Jev probabilities" to see the raw `noul` score behind each card's band.

The brand, nav, hero, and footer never change between personas — only emphasis, order,
framing, and the Spotlight payload do.
