# IntentLink

IntentLink is a Chrome extension that carries a user's prompt from an agent chat (ChatGPT, Claude) into a real website, then reshapes that page around the prompt: matches highlighted, clutter dimmed or hidden, and a direct answer pinned at the top. The page stays the real page, so the cart, checkout and links keep working.

## Concept: intent handoff

The user states their intent in a chat they already use. The chat replies with an **IntentLink**: the site's search URL plus the prompt in the fragment, `#ll-intent=<URL-encoded prompt>`. Clicking it opens Chrome, and the extension reshapes the page. The fragment never reaches the site's server.

Because any chat can write the link, IntentLink is a candidate open convention for agents as first-class visitors (AX).

> Personalization from stated intent, not guessed intent. "Any agent can make an IntentLink."

## Context

Built in one day for **The Living Internet Build Day** at AGI House, presented by Coframe (themes: generative UI, personalization engines, interfaces built for agents).

## Status

Early build — see `IntentLink — PRD & Design.pdf` for the full product spec, architecture, and build plan.

## How it works

1. In ChatGPT or Claude, the user types their intent; the chat replies with a clickable IntentLink.
2. Clicking it opens the target site (e.g. Amazon search results).
3. The content script reads the `#ll-intent` fragment and extracts page items.
4. A rank call (LLM or local heuristic) decides what to keep, dim, or hide.
5. The page re-renders in place — highlighted matches, dimmed non-matches, a pinned summary bar with a refine box for live follow-up prompts.

## Non-goals

- No chat UI of our own, no backend server, no accounts.
- No fully generated replacement website — the real page is always underneath.
- No agent that clicks, buys, or fills forms on the user's behalf.
