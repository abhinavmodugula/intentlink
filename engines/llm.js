// Default rank engine: DeepSeek (OpenAI-compatible chat/completions, JSON mode).
// Implements rank(intent, items, context) -> {filters, summary, keep:[{id, reason, score}]}.
// Any thrown error is caught by background.js, which falls back to the heuristic engine.
(function (global) {
  const ENDPOINT = "https://api.deepseek.com/chat/completions";

  const SYSTEM_PROMPT_SEARCH = `You rank shopping search results against a shopper's stated intent.
Return strict JSON only, matching this schema exactly:
{"filters":{"priceMax":number|null,"ratingMin":number|null,"prime":boolean|null},
 "summary":"string, e.g. '4 of 48 match: under $100, 4★+, Prime'",
 "keep":[{"id":"string, must be one of the given item ids","reason":"short phrase, e.g. 'ANC, 30h battery, $79'"}]}
Rules:
- Only include ids that genuinely match the intent in "keep".
- Infer filters (priceMax, ratingMin, prime) from the intent when stated; use null if not stated.
- Never include an id whose price exceeds a stated priceMax, or whose rating is below a stated ratingMin.
- Output the JSON object only, no other text.`;

  // Product-detail mode: the items are facts about ONE product (feature bullets, spec rows,
  // review snippets), not competing products — the job is picking evidence, not filtering a list.
  const SYSTEM_PROMPT_PRODUCT = `You pick which facts about a single product are evidence that it matches a shopper's stated intent.
You are given facts extracted from one product's page (feature bullets, spec rows, review
snippets) — not a list of competing products.
Return strict JSON only, matching this schema exactly:
{"filters":null,
 "summary":"string, a short phrase naming the supporting facts, e.g. 'whisper-quiet dual motors, anti-wobble steel frame, 48in wide'",
 "keep":[{"id":"string, must be one of the given item ids","reason":"short phrase quoting or paraphrasing the specific detail"}]}
Rules:
- Only include ids that are genuine supporting evidence for the stated intent.
- Leave out facts with no bearing on the intent (warranty, color options, shipping, unrelated specs).
- "summary" must not start with "Recommended because" — the caller adds that prefix.
- Output the JSON object only, no other text.`;

  async function llm(intent, items, context = {}) {
    const apiKey = global.LL_CONFIG && global.LL_CONFIG.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("llm engine: missing DEEPSEEK_API_KEY");

    const isProduct = context.pageType === "product";
    const systemPrompt = isProduct ? SYSTEM_PROMPT_PRODUCT : SYSTEM_PROMPT_SEARCH;

    const compactItems = items.map((it) => ({
      id: it.id,
      title: it.title,
      kind: it.kind,
      price: it.price,
      rating: it.rating,
      reviewCount: it.reviewCount,
      prime: it.prime,
    }));

    const requestBody = {
      model: "deepseek-chat",
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 1200, // bounds JSON-mode output; ~30 items of short reasons fits comfortably
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify({ intent, items: compactItems }) },
      ],
    };

    console.group(`%cIntentLink[llm] request`, "color:#c9922b");
    console.log("intent:", intent);
    console.log("items sent:", compactItems);
    console.groupEnd();

    const t0 = performance.now();
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });
    const ms = Math.round(performance.now() - t0);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`IntentLink[llm] HTTP ${res.status} after ${ms}ms`, text);
      throw new Error(`llm engine: DeepSeek HTTP ${res.status}`);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;

    console.group(`%cIntentLink[llm] response (${ms}ms)`, "color:#2a7a4a");
    console.log("raw response:", data);
    console.log("content:", content);
    console.groupEnd();

    if (!content) throw new Error("llm engine: empty response");

    const plan = JSON.parse(content);
    if (!plan || !Array.isArray(plan.keep)) throw new Error("llm engine: malformed plan");

    // DeepSeek gives no calibrated per-item probability — every kept item is a full highlight.
    plan.keep = plan.keep.map((k) => ({ ...k, score: 1 }));

    console.log(
      `%cIntentLink[llm] plan: ${plan.keep.length}/${items.length} kept`,
      "color:#2a7a4a;font-weight:bold",
      plan
    );

    return plan;
  }

  global.LL_ENGINES = global.LL_ENGINES || {};
  global.LL_ENGINES.llm = llm;
})(typeof self !== "undefined" ? self : window);
