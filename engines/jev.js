// Optional rank engine: TypeSafe Jev (System One model). One noul (yes/no probability)
// question per item, in a single call. Jev cannot write prose, so the summary and reasons
// are assembled in JS from parsed constraints (lib/filters.js) — same as the heuristic engine.
// Implements the same rank(intent, items, context) contract as engines/llm.js.
//
// Product-detail mode: Jev's per-item probability is a good fit for "is this page fact relevant
// enough to highlight?" — unlike engines/llm.js (which returns score=1 for every kept id), Jev's
// calibrated noul score drives the existing ll-keep (>=0.8) / ll-maybe (0.5-0.8) ring distinction
// directly, so a single call doubles as both the keep/dim decision and the highlight strength.
(function (global) {
  const ENDPOINT = "https://api.typesafe.ai/v1/systemone";
  // Below this, item is dimmed; threshold-0.8 is a "maybe" ring, >0.8 full keep. Lowered from 0.5
  // after observing real call-to-call variance on compound intents — e.g. a fact explicitly named
  // in the intent scored 0.05 on one call and 0.41 on a re-run of the same request. 0.5 was
  // dropping genuinely-matching facts; this isn't a perfect fix for the underlying variance, but
  // it catches more of the "good" calls without re-admitting clearly-irrelevant items (those
  // scored 0.02-0.09 in the same log, well under this threshold either way).
  const KEEP_THRESHOLD = 0.3;

  async function jev(intent, items, context = {}) {
    const apiKey = global.LL_CONFIG && global.LL_CONFIG.JEV_API_KEY;
    if (!apiKey) throw new Error("jev engine: missing JEV_API_KEY");

    const isProduct = context.pageType === "product";

    const questions = {};
    for (const it of items) {
      // Product mode: a compound intent ("A, B, and C") means any single fact can only ever
      // support one clause of it — asking whether a fact is "strong evidence of the full match"
      // (the original phrasing) systematically undersells facts that answer just one clause,
      // even when it's exactly what was asked for. Asking about relevance to ANY part of the
      // intent instead scores those facts more consistently without losing the ability to reject
      // genuinely irrelevant ones (an EV-charging tag still won't be "relevant" to a kitchen ask).
      const instructions = isProduct
        ? `Is this fact relevant to anything the shopper is looking for? Shopper's request: "${intent}" Fact: "${it.title}"`
        : `Does this item ("${it.title}", $${it.price}${it.rating != null ? `, ${it.rating}★` : ""}${it.prime ? ", Prime" : ""}) match the shopper's intent: "${intent}"?`;
      questions[it.id] = { type: "noul", instructions };
    }

    const requestBody = {
      model: "jev-latest",
      state: { intent, itemCount: items.length, pageType: isProduct ? "product" : "search" },
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

    const filters = isProduct ? null : global.LL_FILTERS.parseConstraints(intent);
    const keep = [];
    for (const it of items) {
      if (it.sponsored) continue;
      const score = answers[it.id]?.noul;
      if (typeof score !== "number" || score < KEEP_THRESHOLD) continue;
      if (!global.LL_FILTERS.passesFilters(it, filters)) continue;

      let reason;
      if (isProduct) {
        reason = it.title.length > 80 ? `${it.title.slice(0, 77)}…` : it.title;
      } else {
        const reasonBits = [];
        if (it.price != null) reasonBits.push(`$${it.price}`);
        if (it.rating != null) reasonBits.push(`${it.rating}★`);
        if (it.prime) reasonBits.push("Prime");
        reason = reasonBits.join(" · ") || "matches filters";
      }
      keep.push({ id: it.id, reason, score });
    }

    // Highest-probability facts first, so a product-mode summary leads with the strongest evidence.
    keep.sort((a, b) => b.score - a.score);

    let summary;
    if (isProduct) {
      summary = keep.length ? keep.slice(0, 3).map((k) => k.reason).join(", ") : "no strong evidence found";
    } else {
      const parts = [];
      if (filters.priceMax != null) parts.push(`under $${filters.priceMax}`);
      if (filters.ratingMin != null) parts.push(`${filters.ratingMin}★+`);
      if (filters.prime) parts.push("Prime");
      summary = `${keep.length} of ${items.length} match${parts.length ? ": " + parts.join(", ") : ""}`;
    }

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
