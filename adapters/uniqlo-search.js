// Uniqlo search/listing-page adapter. Exposes window.LL_ADAPTER on the same contract as
// adapters/amazon-search.js: {extract, clutterSelectors, pageType:"search"}.
//
// Selectors verified against a live page (uniqlo.com/us/en/search?q=mens+shirts) via a manual
// DOM diagnostic — curl/WebFetch both get a 403 from Akamai, so this couldn't be automated.
// Uniqlo's frontend is a client-rendered React app with no __NEXT_DATA__/JSON-LD on the search
// page, and is mid-migration between two design systems: the main results grid uses the older
// "ITO" component set (.product-tile, [data-testid="ITOTypography"]), while at least one
// carousel elsewhere on the page (recommendations) uses a newer "fr-ec-*" tile — scoping to
// .fr-ec-product-collection .product-tile deliberately targets only the real results grid
// (confirmed 24 direct children = 24 tiles on the sampled page), not carousel upsells.
(function () {
  function isUniqloSearchPage() {
    if (!/(^|\.)uniqlo\.com$/.test(location.hostname)) return false;
    if (location.pathname.includes("/search")) return true;
    try {
      return new URLSearchParams(location.search).has("q");
    } catch {
      return false;
    }
  }
  if (!isUniqloSearchPage()) return;
  if (window.LL_ADAPTER) return; // another matched adapter already claimed this page

  const MAX_ITEMS = 30;
  const GRID_TILE_SELECTOR = ".fr-ec-product-collection .product-tile";
  const FALLBACK_TILE_SELECTOR = ".product-tile"; // unscoped — used only if the grid wrapper changes

  function normalize(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function extractTitle(tile) {
    // The image alt text mirrors the product name exactly and is far more reliable than
    // picking the right text run out of ~6 generic ITOTypography labels per tile (size range,
    // gender tag, promo badge, etc. all share the same component).
    const img = tile.querySelector("img[alt]");
    return img ? normalize(img.getAttribute("alt")) : "";
  }

  function extractPrice(tile) {
    const texts = Array.from(tile.querySelectorAll('[data-testid="ITOTypography"]')).map((el) =>
      normalize(el.textContent)
    );
    const priceText = texts.find((t) => /^\$\s?\d/.test(t));
    if (!priceText) return null;
    const n = parseFloat(priceText.replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : null;
  }

  // Rating/review count render via a different widget (not ITOTypography) as trailing text like
  // "4.7(999+)" with no separating whitespace — not in the typography text list, so pulled via
  // regex over the tile's full text instead.
  function extractRatingAndReviews(tile) {
    const text = normalize(tile.textContent);
    const m = text.match(/(\d(?:\.\d)?)\s*\((\d[\d,]*)\+?\)/);
    if (!m) return { rating: null, reviewCount: null };
    return {
      rating: parseFloat(m[1]),
      reviewCount: parseInt(m[2].replace(/,/g, ""), 10),
    };
  }

  // content.js's "promote to top" reorder (shared, adapter-agnostic) only moves nodes that are
  // direct siblings under one shared parent. .product-tile isn't that — it's nested two levels
  // inside its own unique <a> wrapper (.product-tile -> <a> -> <div> -> .fr-ec-product-collection).
  // So data-ll-id (and every class toggle/reorder keyed off it) goes on that direct-child wrapper
  // instead, walking up from the tile until its own parent is the grid container.
  function findPromotableNode(tile) {
    let node = tile;
    while (node.parentElement) {
      if (node.parentElement.classList?.contains("fr-ec-product-collection")) return node;
      node = node.parentElement;
    }
    return tile; // no grid ancestor found (e.g. FALLBACK_TILE_SELECTOR path) — tag the tile itself
  }

  function extract() {
    let tiles = Array.from(document.querySelectorAll(GRID_TILE_SELECTOR));
    if (!tiles.length) tiles = Array.from(document.querySelectorAll(FALLBACK_TILE_SELECTOR));
    tiles = tiles.slice(0, MAX_ITEMS);

    const items = [];
    tiles.forEach((tile, i) => {
      const title = extractTitle(tile);
      const price = extractPrice(tile);
      if (!title || price === null) return; // PRD: skip items missing a price

      const id = `ll-${i}`;
      findPromotableNode(tile).setAttribute("data-ll-id", id);
      const { rating, reviewCount } = extractRatingAndReviews(tile);
      items.push({ id, title, price, rating, reviewCount, prime: false, sponsored: false });
    });

    if (!items.length) {
      console.warn(
        "IntentLink[uniqlo]: 0 items extracted from .product-tile — Uniqlo's layout may have " +
          "changed since this adapter was calibrated (see adapters/uniqlo-search.js)"
      );
    } else {
      console.log(`IntentLink[uniqlo]: extracted ${items.length} item(s)`, items);
    }
    return items;
  }

  window.LL_ADAPTER = {
    extract,
    clutterSelectors: [], // no sponsored/promo markup observed on the sampled page
    pageType: "search",
  };
})();
