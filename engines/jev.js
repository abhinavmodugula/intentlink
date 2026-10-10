// Optional rank engine: TypeSafe Jev (System One model). One noul (yes/no probability)
// question per item, in a single call. Jev cannot write prose, so the summary and reasons
// are assembled in JS from parsed constraints (lib/filters.js) — same as the heuristic engine.
// Implements the same rank(intent, items) contract as engines/llm.js.
(function (global) {
  const ENDPOINT = "https://api.typesafe.ai/v1/systemone";
  const KEEP_THRESHOLD = 0.5; // below this, item is dimmed; 0.5-0.8 is a "maybe" ring, >0.8 full keep

  async function jev(intent, items) {
    const apiKey = global.LL_CONFIG && global.LL_CONFIG.JEV_API_KEY;
    if (!apiKey) throw new Error("jev engine: missing JEV_API_KEY");

    const questions = {};
    for (const it of items) {
      const bits = [`"${it.title}"`, `$${it.price}`];
      if (it.rating != null) bits.push(`${it.rating}★`);
      if (it.prime) bits.push("Prime");
      questions[it.id] = {
        type: "noul",
        instructions: `Does this item (${bits.join(", ")}) match the shopper's intent: "${intent}"?`,
      };
    }

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "jev-latest",
        state: { intent, itemCount: items.length },
        questions,
      }),
    });

    if (!res.ok) throw new Error(`jev engine: HTTP ${res.status}`);

    const data = await res.json();
    const answers = data?.answers;
    if (!answers) throw new Error("jev engine: empty response");

    const filters = global.LL_FILTERS.parseConstraints(intent);
    const keep = [];
    for (const it of items) {
      if (it.sponsored) continue;
      const score = answers[it.id]?.noul;
      if (typeof score !== "number" || score < KEEP_THRESHOLD) continue;
      if (!global.LL_FILTERS.passesFilters(it, filters)) continue;

      const reasonBits = [];
      if (it.price != null) reasonBits.push(`$${it.price}`);
      if (it.rating != null) reasonBits.push(`${it.rating}★`);
      if (it.prime) reasonBits.push("Prime");
      keep.push({ id: it.id, reason: reasonBits.join(" · ") || "matches filters", score });
    }

    const parts = [];
    if (filters.priceMax != null) parts.push(`under $${filters.priceMax}`);
    if (filters.ratingMin != null) parts.push(`${filters.ratingMin}★+`);
    if (filters.prime) parts.push("Prime");
    const summary = `${keep.length} of ${items.length} match${parts.length ? ": " + parts.join(", ") : ""}`;

    return { filters, summary, keep };
  }

  global.LL_ENGINES = global.LL_ENGINES || {};
  global.LL_ENGINES.jev = jev;
})(typeof self !== "undefined" ? self : window);
