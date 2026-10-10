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

    const requestBody = {
      model: "jev-latest",
      state: { intent, itemCount: items.length },
      questions,
    };

    console.group(`%cIntentLink[jev] request`, "color:#c9922b");
    console.log("intent:", intent);
    console.log("questions:", questions);
    console.log("raw body:", requestBody);
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
      console.error(`IntentLink[jev] HTTP ${res.status} after ${ms}ms`, text);
      throw new Error(`jev engine: HTTP ${res.status}`);
    }

    const data = await res.json();
    const answers = data?.answers;

    console.group(`%cIntentLink[jev] response (${ms}ms)`, "color:#2a7a4a");
    console.log("raw response:", data);
    if (answers) {
      console.table(
        Object.entries(answers).map(([id, a]) => ({
          id,
          noul: a?.noul,
          title: items.find((it) => it.id === id)?.title,
        }))
      );
    }
    console.groupEnd();

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

    console.log(
      `%cIntentLink[jev] plan: ${keep.length}/${items.length} kept`,
      "color:#2a7a4a;font-weight:bold",
      { filters, summary, keep }
    );

    return { filters, summary, keep };
  }

  global.LL_ENGINES = global.LL_ENGINES || {};
  global.LL_ENGINES.jev = jev;
})(typeof self !== "undefined" ? self : window);
