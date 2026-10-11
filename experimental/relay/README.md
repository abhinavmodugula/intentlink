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

- `cards.js` — ~12 **Features** cards shared by every reader. Each has a neutral `summary`
  (what Jev scores) and a `dev` / `finance` framing variant of the same fact.
- `spotlight.js` — 3 **Spotlight** deep-dive panels with hyper-specific, hand-written payloads:
  - `oss-commands` — exact curl/Python snippets for calling open-weight models (Llama, Mixtral,
    Qwen, DeepSeek) through the gateway, in general.
  - `deepseek-tutorial` — a hyper-specific tutorial for a developer who wants *DeepSeek*
    specifically: `deepseek-chat` (V3) vs `deepseek-reasoner` (R1), the R1-only
    `reasoning_content` field, and DeepSeek-specific notes (ignored sampling params on R1,
    prompt caching passthrough). Written to be distinct enough from `oss-commands` that Jev's
    relevance scoring picks this one over the generic OSS panel for a DeepSeek-specific intent.
  - `pricing-breakdown` — an exact per-token pricing table plus a worked monthly-bill
    comparison against per-seat Claude Code / Cursor pricing (illustrative figures, labeled as
    such — not a real benchmark from Anthropic or Cursor).
  - `compliance-dive` — SOC2/procurement checklist.

Nothing in either file is written or rewritten by Jev. All text is static.

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

- `I want to use open-source models` → Features reorder to lead with the API/routing/catalog
  cards in dev framing; the Spotlight expands `oss-commands`.
- `I'm a developer who specifically wants to use DeepSeek models` → same Features reorder, but
  the Spotlight expands `deepseek-tutorial` instead of the generic `oss-commands` — the exact
  DeepSeek tutorial (deepseek-chat vs deepseek-reasoner, `reasoning_content`, prompt caching).
- `CFO, our LLM bill tripled last month, justify the spend` → Features reorder to lead with
  pricing/spend-analytics/budget-controls in finance framing; the Spotlight expands
  `pricing-breakdown` with the cost chart.
- Toggle "Show Jev probabilities" to see the raw `noul` score behind each card's band.

The brand, nav, hero, and footer never change between personas — only emphasis, order,
framing, and the Spotlight payload do.
