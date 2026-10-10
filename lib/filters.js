// Shared, dependency-free filter/keyword helpers.
// Loaded both as a content-script file (global = window) and via importScripts in the
// service worker (global = self), so it must not assume either — hence the IIFE wrapper.
(function (global) {
  function parseConstraints(intent) {
    const text = (intent || "").toLowerCase();
    const constraints = {};

    const priceMatch =
      text.match(/(?:under|below|less than|<)\s*\$?\s*(\d+(?:\.\d+)?)/) ||
      text.match(/\$\s*(\d+(?:\.\d+)?)\s*(?:or less|max|maximum)/);
    if (priceMatch) constraints.priceMax = parseFloat(priceMatch[1]);

    const ratingMatch = text.match(/(\d(?:\.\d)?)\s*\+?\s*(?:star|stars|★)/);
    if (ratingMatch) constraints.ratingMin = parseFloat(ratingMatch[1]);

    if (/\bprime\b/.test(text)) constraints.prime = true;

    return constraints;
  }

  // Deterministic re-check (F6): drop anything that provably violates a parsed constraint.
  function passesFilters(item, filters) {
    if (!filters) return true;
    if (filters.priceMax != null && item.price != null && item.price > filters.priceMax) {
      return false;
    }
    if (filters.ratingMin != null && item.rating != null && item.rating < filters.ratingMin) {
      return false;
    }
    if (filters.prime === true && !item.prime) return false;
    return true;
  }

  const STOPWORDS = new Set([
    "a", "an", "the", "for", "and", "or", "with", "under", "over", "below",
    "less", "than", "good", "that", "this", "of", "in", "on", "to", "is",
    "are", "will", "do", "does", "my", "fit", "it", "only",
  ]);

  function keywordWords(intent) {
    return (intent || "")
      .toLowerCase()
      .replace(/[^a-z0-9$.\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w) && !/^\d+(\.\d+)?$/.test(w));
  }

  function keywordScore(item, words) {
    if (!words.length) return 0;
    const title = (item.title || "").toLowerCase();
    let hits = 0;
    for (const w of words) if (title.includes(w)) hits++;
    return hits / words.length;
  }

  global.LL_FILTERS = { parseConstraints, passesFilters, keywordWords, keywordScore };
})(typeof self !== "undefined" ? self : window);
