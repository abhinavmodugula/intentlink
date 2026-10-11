# Relay demo IntentLinks

Same convention as the main repo's `demo/test-links.md`: each link encodes the intent in the
URL hash as `#ll-intent=<encoded intent>`. Paste any of these into a browser while
`node experimental/relay/server.mjs` is running — the page reads the hash on load, fills the
intent box, and fires the same Jev call a live keystroke would.

Regenerate/extend this list with:

```js
const scenarios = [ /* { title, expect, intent } */ ];
for (const s of scenarios) {
  console.log(`http://localhost:8787/#ll-intent=${encodeURIComponent(s.intent)}`);
}
```

These scenarios are deliberately **abstract** — none of them share vocabulary with the card or
Spotlight panel they should surface. A link that just said "I want open-source models" would
prove keyword matching, not reasoning.

## Launch in two days, scared of load

> Our launch is in two days and I am worried the bot falls over under load

Expect: `reliability-playbook` Spotlight panel (the exact fallback-chain / rate-limit / alert
config); routing, fallback, reliability, and usage-alert cards rise.

[Open, shaped for this intent](http://localhost:8787/#ll-intent=Our%20launch%20is%20in%20two%20days%20and%20I%20am%20worried%20the%20bot%20falls%20over%20under%20load)

```
http://localhost:8787/#ll-intent=Our%20launch%20is%20in%20two%20days%20and%20I%20am%20worried%20the%20bot%20falls%20over%20under%20load
```

## Finance is asking about the bill

> Finance pinged me about last month's AI bill and I do not have a good answer yet

Expect: `pricing-breakdown` Spotlight panel with the cost chart; pricing, spend-analytics, and
budget-control cards rise in finance framing.

[Open, shaped for this intent](http://localhost:8787/#ll-intent=Finance%20pinged%20me%20about%20last%20month's%20AI%20bill%20and%20I%20do%20not%20have%20a%20good%20answer%20yet)

```
http://localhost:8787/#ll-intent=Finance%20pinged%20me%20about%20last%20month's%20AI%20bill%20and%20I%20do%20not%20have%20a%20good%20answer%20yet
```

## Legal is blocking the deal

> Legal will not let us sign the contract until they see our data handling story

Expect: `compliance-dive` Spotlight panel; compliance, data-residency, and workspaces/SSO cards
rise.

[Open, shaped for this intent](http://localhost:8787/#ll-intent=Legal%20will%20not%20let%20us%20sign%20the%20contract%20until%20they%20see%20our%20data%20handling%20story)

```
http://localhost:8787/#ll-intent=Legal%20will%20not%20let%20us%20sign%20the%20contract%20until%20they%20see%20our%20data%20handling%20story
```

## Need visible step-by-step reasoning

> I need a model that shows its reasoning step by step for a math tutoring product

Expect: `deepseek-tutorial` Spotlight panel — over the generic `oss-commands` panel — purely
from inference; the intent never says "DeepSeek." Verified live against the real Jev API:
`deepseek-tutorial` scored 0.33 vs. `oss-commands`' 0.24, with every other panel ≤0.04.

[Open, shaped for this intent](http://localhost:8787/#ll-intent=I%20need%20a%20model%20that%20shows%20its%20reasoning%20step%20by%20step%20for%20a%20math%20tutoring%20product)

```
http://localhost:8787/#ll-intent=I%20need%20a%20model%20that%20shows%20its%20reasoning%20step%20by%20step%20for%20a%20math%20tutoring%20product
```
