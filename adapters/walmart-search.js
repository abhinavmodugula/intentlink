// Walmart search-results adapter. Exposes window.LL_ADAPTER.
// Mirrors adapters/amazon-search.js: pure DOM extraction, tolerant of a couple of layout
// variants per field. Walmart's DOM leans on data-testid/data-automation-id attributes rather
// than Amazon's ids/classes, which tend to be more stable across their A/B tests — but these
// are still best-effort and should be checked against a live walmart.com/search page and
// adjusted if a field comes back empty.
(function () {
  // Search and product-detail adapters share this content-script bundle and self-guard on
  // mutually exclusive URL shapes, so only one of them ever registers window.LL_ADAPTER.
  function isSearchPage() {
    return location.pathname === "/search" || location.pathname.startsWith("/search/");
  }
  if (!isSearchPage()) return;

  const RESULT_SELECTOR = "[data-item-id]";
  const MAX_ITEMS = 30;

  const CLUTTER_SELECTORS = [
    "[data-testid='sponsoredLabel']",
    "[data-testid='sponsored-products-carousel']",
    "[data-testid='carousel']",
    "[data-testid='related-searches']",
  ];

  function firstMatch(node, selectors) {
    for (const sel of selectors) {
      const el = node.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function extractTitle(node) {
    const el = firstMatch(node, [
      "[data-automation-id='product-title']",
      "[data-testid='product-title']",
      "span.w_V_DM",
    ]);
    return el ? el.textContent.trim() : "";
  }

  function extractPrice(node) {
    const el = firstMatch(node, [
      "[data-automation-id='product-price'] span",
      "[data-testid='price-wrap'] span",
      "[itemprop='price']",
    ]);
    if (!el) return null;
    const n = parseFloat((el.textContent || "").replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : null;
  }

  function extractRating(node) {
    const el = firstMatch(node, [
      "[data-testid='product-ratings']",
      "[aria-label*='stars']",
      "span.w_iUH7",
    ]);
    if (!el) return null;
    const text = el.getAttribute("aria-label") || el.textContent || "";
    const m = text.match(/([\d.]+)\s*out of 5/) || text.match(/([\d.]+)\s*stars?/);
    return m ? parseFloat(m[1]) : null;
  }

  function extractReviewCount(node) {
    const el = firstMatch(node, [
      "[data-testid='product-reviews-count']",
      "[data-automation-id='product-reviews']",
    ]);
    if (!el) return null;
    const n = parseInt((el.textContent || "").replace(/[^0-9]/g, ""), 10);
    return Number.isFinite(n) ? n : null;
  }

  // Walmart has no Prime equivalent; "fast shipping" badges (Walmart+/two-day) are the closest
  // analogue. lib/filters.js only checks item.prime when the stated intent says "prime", so a
  // constant false here is inert unless an intent happens to mention it.
  function extractFastShipping(node) {
    return !!firstMatch(node, [
      "[data-testid='fulfillment-badge']",
      "[aria-label*='shipping, arrives']",
    ]);
  }

  function extractSponsored(node) {
    return !!firstMatch(node, ["[data-testid='sponsoredLabel']", "[data-automation-id='sponsoredLabel']"]);
  }

  function extract() {
    const nodes = Array.from(document.querySelectorAll(RESULT_SELECTOR)).slice(0, MAX_ITEMS);
    const items = [];

    nodes.forEach((node, i) => {
      const id = `ll-${i}`;
      const title = extractTitle(node);
      const price = extractPrice(node);
      // Skip items missing a price — they can't be filtered reliably (matches the Amazon adapter).
      if (!title || price === null) return;

      node.setAttribute("data-ll-id", id);
      items.push({
        id,
        title,
        price,
        rating: extractRating(node),
        reviewCount: extractReviewCount(node),
        prime: extractFastShipping(node),
        sponsored: extractSponsored(node),
      });
    });

    return items;
  }

  window.LL_ADAPTER = {
    extract,
    clutterSelectors: CLUTTER_SELECTORS,
    resultSelector: RESULT_SELECTOR,
    pageType: "search",
  };
})();
