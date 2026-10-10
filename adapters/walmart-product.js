// Walmart product-detail-page (PDP) adapter. Exposes window.LL_ADAPTER.
// Mirrors adapters/amazon-product.js: there's one product and a page full of supporting facts
// (highlight bullets, review snippets — no specs, see note below), each becoming an "item" so
// the existing keep/dim/hide/chip pipeline in content.js can decide which facts are the
// evidence for why this product matches the stated intent. Pure DOM extraction, no model calls.
(function () {
  // Search and product-detail adapters share this content-script bundle and self-guard on
  // mutually exclusive URL shapes, so only one of them ever registers window.LL_ADAPTER.
  function isProductPage() {
    return location.pathname.startsWith("/ip/");
  }
  if (!isProductPage()) return;

  const MAX_BULLETS = 20;
  const MAX_REVIEWS = 5;
  const MAX_REVIEW_CHARS = 400;

  // Hidden (not dimmed) because it's reversible — Reset sweeps every .ll-hide node back.
  // None of these touch the title/images/buy box/bullets/specs/reviews, which must stay.
  const CLUTTER_SELECTORS = [
    "[data-testid='sponsoredLabel']",
    "[data-testid='sponsored-products-carousel']",
    "[data-testid='similar-items-carousel']",
    "[data-testid='also-considered-carousel']",
    "[data-testid='compare-similar-items']",
    "[data-testid='product-qna']",
    "[data-testid='carousel']",
  ];

  let nextId = 0;
  const seenText = new Set();

  function normalize(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function isVisible(node) {
    return !!node && node.offsetParent !== null;
  }

  // Tags `node` with a fresh data-ll-id and pushes a {id, title, kind, ...nulls} item,
  // de-duping on normalized text so overlapping sections aren't highlighted twice.
  function pushItem(items, node, text, kind) {
    const title = normalize(text);
    if (!title || seenText.has(title)) return;
    seenText.add(title);

    const id = `ll-p-${nextId++}`;
    node.setAttribute("data-ll-id", id);
    items.push({
      id,
      title,
      kind,
      price: null,
      rating: null,
      reviewCount: null,
      prime: null,
      sponsored: false,
    });
  }

  // "About this item" highlight bullets. Confirmed against a live /ip/ page (2026-10):
  // #top-highlights-module wraps a <ul class="list ... flex flex-column"> of plain <li> facts.
  const BULLET_SELECTOR = "#top-highlights-module li";

  // No spec extraction on Walmart: #specifications-wrapper / #item-product-details are
  // collapsed accordions whose row content isn't mounted in the DOM until a shopper clicks to
  // expand them (confirmed live — outerHTML dump showed only the header + toggle button, no
  // rows). IntentLink never simulates clicks on the page, so bullets + reviews are the evidence
  // source here instead.

  function extractBullets(items) {
    const nodes = document.querySelectorAll(BULLET_SELECTOR);
    for (const node of nodes) {
      if (items.length >= MAX_BULLETS) break;
      if (!isVisible(node)) continue;
      pushItem(items, node, node.textContent, "bullet");
    }
  }

  // Review evidence: rather than individual review cards (they live in a carousel that reuses
  // the same generic "carousel-container" test id as unrelated carousels elsewhere on the page,
  // making them hard to disambiguate), use Walmart's own AI-generated "Reviews summary" —
  // Pros/Cons bullets distilled from real customer reviews. Confirmed live (2026-10):
  // #generated-by-ai-info-summary wraps a [data-testid='bulleted-summary'] with Pros/Cons <li>
  // facts like "Affordable price: Offers good quality at a reasonable cost." Already mounted at
  // page load (not lazy, unlike specs), so no observer is needed here.
  const REVIEW_SELECTOR = "#generated-by-ai-info-summary [data-testid='bulleted-summary'] li";

  function extractReviews(items) {
    const nodes = document.querySelectorAll(REVIEW_SELECTOR);
    let count = 0;
    for (const node of nodes) {
      if (count >= MAX_REVIEWS) break;
      if (!isVisible(node)) continue;
      const text = normalize(node.textContent).slice(0, MAX_REVIEW_CHARS);
      if (!text) continue;
      pushItem(items, node, text, "review");
      count++;
    }
  }

  function extract() {
    const items = [];
    extractBullets(items);
    const afterBullets = items.length;
    extractReviews(items);
    console.log(
      `IntentLink[walmart-product]: extracted ${items.length} item(s) — ` +
        `${afterBullets} bullet(s), ${items.length - afterBullets} review(s)`
    );
    return items;
  }

  window.LL_ADAPTER = {
    extract,
    clutterSelectors: CLUTTER_SELECTORS,
    pageType: "product",
    promote: false, // highlight facts in place; a PDP has no "list" to reorder
  };
})();
