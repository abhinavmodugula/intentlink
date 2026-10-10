// Default rank engine: DeepSeek (OpenAI-compatible chat/completions, JSON mode).
// Implements rank(intent, items) -> {filters, summary, keep:[{id, reason, score}]}.
// Any thrown error is caught by background.js, which falls back to the heuristic engine.
(function (global) {
  const ENDPOINT = "https://api.deepseek.com/chat/completions";

  const SYSTEM_PROMPT = `You rank shopping search results against a shopper's stated intent.
Return strict JSON only, matching this schema exactly:
{"filters":{"priceMax":number|null,"ratingMin":number|null,"prime":boolean|null},
 "summary":"string, e.g. '4 of 48 match: under $100, 4★+, Prime'",
 "keep":[{"id":"string, must be one of the given item ids","reason":"short phrase, e.g. 'ANC, 30h battery, $79'"}]}
Rules:
- Only include ids that genuinely match the intent in "keep".
- Infer filters (priceMax, ratingMin, prime) from the intent when stated; use null if not stated.
- Never include an id whose price exceeds a stated priceMax, or whose rating is below a stated ratingMin.
- Output the JSON object only, no other text.`;

  async function llm(intent, items) {
    const apiKey = global.LL_CONFIG && global.LL_CONFIG.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("llm engine: missing DEEPSEEK_API_KEY");

    const compactItems = items.map((it) => ({
      id: it.id,
      title: it.title,
      price: it.price,
      rating: it.rating,
      reviewCount: it.reviewCount,
      prime: it.prime,
    }));

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: 1200, // bounds JSON-mode output; ~30 items of short reasons fits comfortably
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify({ intent, items: compactItems }) },
        ],
      }),
    });

    if (!res.ok) throw new Error(`llm engine: DeepSeek HTTP ${res.status}`);

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("llm engine: empty response");

    const plan = JSON.parse(content);
    if (!plan || !Array.isArray(plan.keep)) throw new Error("llm engine: malformed plan");

    // DeepSeek gives no calibrated per-item probability — every kept item is a full highlight.
    plan.keep = plan.keep.map((k) => ({ ...k, score: 1 }));
    return plan;
  }

  global.LL_ENGINES = global.LL_ENGINES || {};
  global.LL_ENGINES.llm = llm;
})(typeof self !== "undefined" ? self : window);
