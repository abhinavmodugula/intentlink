// Amazon search-results adapter (F4). Exposes window.LL_ADAPTER.
// No model calls here — pure DOM extraction, tolerant of a couple of layout variants per field.
(function () {
  const RESULT_SELECTOR = "[data-component-type='s-search-result']";
  const MAX_ITEMS = 30;

  const CLUTTER_SELECTORS = [
    "[data-component-type='sp-sponsored-result']",
    ".s-widget-container.s-widget-container-height-large",
    ".a-carousel-container",
    "[data-component-type='sbv-sponsored-brand']",
  ];

  function firstMatch(node, selectors) {
    for (const sel of selectors) {
      const el = node.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function extractTitle(node) {
    const el = firstMatch(node, ["h2 span", "h2 a span", ".a-size-medium.a-color-base"]);
    return el ? el.textContent.trim() : "";
  }

  function extractPrice(node) {
    const el = firstMatch(node, [".a-price .a-offscreen", ".a-price-whole"]);
    if (!el) return null;
    const n = parseFloat(el.textContent.replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : null;
  }

  function extractRating(node) {
    const el = firstMatch(node, [
      "[aria-label$='out of 5 stars']",
      "i.a-icon-star-small span.a-icon-alt",
      "i.a-icon-star span.a-icon-alt",
    ]);
    if (!el) return null;
    const text = el.getAttribute("aria-label") || el.textContent || "";
    const m = text.match(/([\d.]+)\s*out of 5/);
    return m ? parseFloat(m[1]) : null;
  }

  function extractReviewCount(node) {
    const el = firstMatch(node, [
      "[aria-label$='ratings'] span.a-size-base",
      "span.a-size-base.s-underline-text",
      "a[aria-label*='ratings'] span",
    ]);
    if (!el) return null;
    const n = parseInt(el.textContent.replace(/[^0-9]/g, ""), 10);
    return Number.isFinite(n) ? n : null;
  }

  function extractPrime(node) {
    return !!firstMatch(node, ["[aria-label='Amazon Prime']", "i.a-icon-prime", ".s-prime"]);
  }

  function extractSponsored(node) {
    return !!(
      node.matches("[data-component-type='sp-sponsored-result']") ||
      firstMatch(node, [
        ".puis-sponsored-label-text",
        "[data-component-type='sp-sponsored-result']",
      ])
    );
  }

  function extract() {
    const nodes = Array.from(document.querySelectorAll(RESULT_SELECTOR)).slice(0, MAX_ITEMS);
    const items = [];

    nodes.forEach((node, i) => {
      const id = `ll-${i}`;
      const title = extractTitle(node);
      const price = extractPrice(node);
      // PRD: skip items missing a price — they can't be filtered reliably.
      if (!title || price === null) return;

      node.setAttribute("data-ll-id", id);
      items.push({
        id,
        title,
        price,
        rating: extractRating(node),
        reviewCount: extractReviewCount(node),
        prime: extractPrime(node),
        sponsored: extractSponsored(node),
      });
    });

    return items;
  }

  window.LL_ADAPTER = {
    extract,
    clutterSelectors: CLUTTER_SELECTORS,
    resultSelector: RESULT_SELECTOR,
  };
})();
