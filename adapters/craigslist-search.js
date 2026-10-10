// Craigslist search-results adapter (apartments and, incidentally, any other /search/ category —
// Craigslist uses the same list template everywhere). Exposes window.LL_ADAPTER on the same
// contract as adapters/amazon-search.js.
//
// Verified directly against the live page via curl (craigslist.org has no bot-wall, unlike
// uniqlo.com/opentable.com which both blocked automated fetches): the result list is plain,
// semantic, unhashed server-rendered HTML — easily the most stable markup of any adapter here.
// All 360 sampled listings matched one consistent shape:
//   <li class="cl-static-search-result" title="...">
//     <a href="...">
//       <div class="title">...</div>
//       <div class="details">
//         <div class="price">$X,XXX</div>
//         <div class="location">neighborhood</div>
//       </div>
//     </a>
//   </li>
// No ads/sponsored markup found mixed into the result list, and the one non-result <li>
// (class="cl-static-hub-links", a "related searches" nav block) is already excluded by scoping
// to li.cl-static-search-result specifically.
(function () {
  function isCraigslistSearchPage() {
    if (!/(^|\.)craigslist\.org$/.test(location.hostname)) return false;
    return location.pathname.includes("/search/");
  }
  if (!isCraigslistSearchPage()) return;
  if (window.LL_ADAPTER) return;

  const RESULT_SELECTOR = "li.cl-static-search-result";
  const MAX_ITEMS = 30;

  function normalize(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function extract() {
    const nodes = Array.from(document.querySelectorAll(RESULT_SELECTOR)).slice(0, MAX_ITEMS);
    const items = [];

    nodes.forEach((node, i) => {
      const titleText = normalize(node.querySelector(".title")?.textContent);
      const priceText = node.querySelector(".price")?.textContent || "";
      const locationText = normalize(node.querySelector(".location")?.textContent);

      const price = priceText ? parseFloat(priceText.replace(/[^0-9.]/g, "")) : null;
      // PRD: skip items missing a price — they can't be filtered reliably. Craigslist listings
      // with no price ("swap", "call for rent", etc.) are a real minority; dropping them here
      // keeps F6's deterministic price filter meaningful for everything that's kept.
      if (!titleText || price === null || !Number.isFinite(price)) return;

      const id = `ll-${i}`;
      node.setAttribute("data-ll-id", id);
      items.push({
        id,
        // Location isn't a separate field in the shared item shape, so fold it into the title —
        // the rank engine can still reason about neighborhood/city mentioned in the intent.
        title: locationText ? `${titleText} — ${locationText}` : titleText,
        price,
        rating: null,
        reviewCount: null,
        prime: false,
        sponsored: false,
      });
    });

    console.log(`IntentLink[craigslist]: extracted ${items.length} item(s)`, items);
    return items;
  }

  window.LL_ADAPTER = {
    extract,
    clutterSelectors: [], // no ads/sponsored markup found in the result list
    resultSelector: RESULT_SELECTOR,
    pageType: "search",
  };
})();
