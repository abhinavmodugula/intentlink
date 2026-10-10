// Pure-JS rank engine: no network call. Used as the 4s-timeout / offline / DEMO_MODE fallback,
// and usable directly via RANK_ENGINE="heuristic". Implements the same rank(intent, items, context)
// contract as engines/llm.js and engines/jev.js. Keyword matching already runs on item.title text,
// so context (pageType) doesn't change behavior here — it's accepted for signature parity only.
(function (global) {
  async function heuristic(intent, items, _context) {
    const filters = global.LL_FILTERS.parseConstraints(intent);
    const words = global.LL_FILTERS.keywordWords(intent);

    const keep = [];
    for (const item of items) {
      if (item.sponsored) continue;
      if (!global.LL_FILTERS.passesFilters(item, filters)) continue;

      const score = global.LL_FILTERS.keywordScore(item, words);
      // If the intent was pure constraints (e.g. "under $100, 4 stars"), no keywords remain —
      // passing the filters alone counts as a match. Otherwise require at least one keyword hit.
      if (words.length > 0 && score === 0) continue;

      const reasonBits = [];
      if (item.price != null) reasonBits.push(`$${item.price}`);
      if (item.rating != null) reasonBits.push(`${item.rating}★`);
      if (item.prime) reasonBits.push("Prime");
      keep.push({
        id: item.id,
        reason: reasonBits.join(" · ") || "matches filters",
        score: Math.min(1, 0.6 + score * 0.4),
      });
    }

    const parts = [];
    if (filters.priceMax != null) parts.push(`under $${filters.priceMax}`);
    if (filters.ratingMin != null) parts.push(`${filters.ratingMin}★+`);
    if (filters.prime) parts.push("Prime");
    const summary = `${keep.length} of ${items.length} match${parts.length ? ": " + parts.join(", ") : ""}`;

    return { filters, summary, keep };
  }

  global.LL_ENGINES = global.LL_ENGINES || {};
  global.LL_ENGINES.heuristic = heuristic;
})(typeof self !== "undefined" ? self : window);
