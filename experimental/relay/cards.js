// Fixed Features deck for the Relay demo. Jev never writes any of this text — it only
// scores relevance/conflict against `summary` and picks a variant via argmax over
// `variants[].blurb`. Both variants describe the same feature, just framed for the reader.
window.RELAY_CARDS = [
  {
    id: "unified-api",
    title: "One API, every model",
    icon: "🔌",
    summary: "A single OpenAI-compatible endpoint that routes to 300+ models, including open-weight models like Llama and Mixtral.",
    variants: [
      { id: "dev", blurb: "Point your existing OpenAI client at one base_url and swap models with a string — no new SDKs, no per-provider glue code." },
      { id: "finance", blurb: "One vendor contract and one invoice instead of five separate model-provider bills to reconcile." },
    ],
  },
  {
    id: "routing",
    title: "Automatic routing & fallback",
    icon: "🔀",
    summary: "Requests automatically fail over to a backup model/provider when the primary is rate-limited, down, or slow.",
    variants: [
      { id: "dev", blurb: "Set a provider priority list per request; a 429 or timeout on the first provider retries on the next one transparently." },
      { id: "finance", blurb: "Fallback routing avoids retry storms and overage charges during provider outages — fewer surprise spend spikes." },
    ],
  },
  {
    id: "latency",
    title: "Latency & throughput",
    icon: "⚡",
    summary: "Per-model p50/p95 latency and tokens/sec, measured continuously across providers so you can route to the fastest one.",
    variants: [
      { id: "dev", blurb: "Live p95 latency and throughput dashboards per model/provider pair, queryable from the same API." },
      { id: "finance", blurb: "Faster responses per dollar: throughput data lets you right-size which model tier a workload actually needs." },
    ],
  },
  {
    id: "streaming",
    title: "Streaming, tool calls, structured output",
    icon: "🧰",
    summary: "Full support for SSE streaming, function/tool calling, and JSON-schema structured outputs, normalized across every model.",
    variants: [
      { id: "dev", blurb: "Same tool-calling and streaming contract regardless of which model answers — no per-provider response parsing." },
      { id: "finance", blurb: "No separate tooling spend: streaming and tool calls are included at the same per-token rate, not billed as add-ons." },
    ],
  },
  {
    id: "catalog",
    title: "Open-source model catalog",
    icon: "📚",
    summary: "300+ models including open-weight models (Llama, Mixtral, Qwen, DeepSeek) alongside frontier closed models, side by side.",
    variants: [
      { id: "dev", blurb: "Open-weight models are first-class citizens — same endpoint, same SDK, often a fraction of the per-token cost." },
      { id: "finance", blurb: "Open-weight models typically cost 5-20x less per token than frontier closed models for comparable tasks." },
    ],
  },
  {
    id: "sdk",
    title: "SDKs & pipeline integration",
    icon: "🧩",
    summary: "Official SDKs for Python/Node, plus drop-in compatibility with LangChain, LlamaIndex, and existing OpenAI-client pipelines.",
    variants: [
      { id: "dev", blurb: "Drop-in replacement for the openai package — change base_url and api_key, nothing else in your pipeline changes." },
      { id: "finance", blurb: "No migration project required: engineering can adopt this without a multi-sprint integration effort." },
    ],
  },
  {
    id: "pricing",
    title: "Pricing: credits vs. dollars",
    icon: "💳",
    summary: "Prepaid credits billed per-token at transparent per-model rates, with no markup on streaming, tool calls, or context length.",
    variants: [
      { id: "dev", blurb: "Per-token rate is listed next to every model in the catalog — no hidden multiplier for streaming or long context." },
      { id: "finance", blurb: "1 credit = $1, consumed per-token at the posted rate. No seat fees, no platform markup, exact usage-based billing." },
    ],
  },
  {
    id: "spend-analytics",
    title: "Spend analytics",
    icon: "📊",
    summary: "Per-key, per-model, per-day breakdowns of token usage and spend, so a spend spike is traceable to its source in minutes.",
    variants: [
      { id: "dev", blurb: "A /usage endpoint and dashboard broken down by API key and model — useful for debugging a runaway retry loop." },
      { id: "finance", blurb: "Answers 'why did last month cost 3x' directly: a per-key, per-day breakdown usually traces it to one misconfigured job." },
    ],
  },
  {
    id: "budget-controls",
    title: "Budget controls",
    icon: "🛡️",
    summary: "Per-key spend caps, rate limits, and alerts that hard-stop or page before a runaway job burns the monthly budget.",
    variants: [
      { id: "dev", blurb: "Set a per-key max-spend cap in the dashboard or via API; requests return 402 once the cap is hit, not a surprise bill." },
      { id: "finance", blurb: "Hard spend caps per team/key eliminate idle and runaway spend — no more after-the-fact invoice surprises." },
    ],
  },
  {
    id: "volume-discounts",
    title: "Volume discounts",
    icon: "📉",
    summary: "Committed monthly spend tiers unlock automatic per-token discounts, stacking with open-weight models' already-low base rates.",
    variants: [
      { id: "dev", blurb: "Discount tiers apply automatically once a workspace crosses a monthly spend threshold — no contract renegotiation." },
      { id: "finance", blurb: "Committing to a monthly spend tier upfront locks in a discount, improving predictability for budgeting." },
    ],
  },
  {
    id: "reliability",
    title: "Reliability & rate limits",
    icon: "📈",
    summary: "99.9% uptime SLA on the routing layer itself, with published per-model rate limits and status history.",
    variants: [
      { id: "dev", blurb: "A public status page and per-model rate-limit docs mean capacity planning doesn't require guesswork." },
      { id: "finance", blurb: "An SLA on the vendor you're actually billed by, independent of any single upstream model provider's uptime." },
    ],
  },
  {
    id: "compliance",
    title: "Security & compliance",
    icon: "🔒",
    summary: "SOC 2 Type II, no training on customer data by default, and configurable data-retention windows per workspace.",
    variants: [
      { id: "dev", blurb: "Data-retention and zero-retention mode are configurable per API key, documented in the same API reference." },
      { id: "finance", blurb: "SOC 2 Type II report available under NDA for procurement review; standard data-processing addendum provided." },
    ],
  },
];
