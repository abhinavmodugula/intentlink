// OpenTable restaurant-detail-page adapter. Exposes window.LL_ADAPTER on the "product" page
// contract (see adapters/amazon-product.js): there's one restaurant, not a list, so items are
// facts/evidence for whether it matches the stated intent, not competing results to filter.
//
// Unlike Amazon's PDP, these facts don't live in visible per-fact DOM elements — curl/WebFetch
// both time out against opentable.com, so this couldn't be verified against a live page either.
// Instead this leans on something confirmed via research rather than guessed: OpenTable
// restaurant pages reliably carry a schema.org Restaurant block in
// <script type="application/ld+json"> (cuisine, price range, rating, review count, address) —
// the PRD's preferred "structured data, no selectors needed" path. Since there's no existing DOM
// node per fact to tag, this adapter synthesizes a small "facts panel" (one row per fact) and
// injects it, the same category of thing content.js already does for its summary bar / answer
// card — then tags each row so the existing keep/dim/chip pipeline works unchanged.
(function () {
  function isOpenTableRestaurantPage() {
    if (!/(^|\.)opentable\.com$/.test(location.hostname)) return false;
    return /^\/r\//.test(location.pathname);
  }
  if (!isOpenTableRestaurantPage()) return;
  if (window.LL_ADAPTER) return;

  const MAX_REVIEWS = 10;
  const MAX_REVIEW_CHARS = 400;

  function normalize(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function findRestaurantNode() {
    const scripts = document.querySelectorAll("script[type='application/ld+json']");
    for (const script of scripts) {
      let data;
      try {
        data = JSON.parse(script.textContent);
      } catch {
        continue;
      }
      const nodes = Array.isArray(data) ? data : [data];
      for (const node of nodes) {
        const type = node["@type"];
        const isRestaurant =
          type === "Restaurant" ||
          type === "FoodEstablishment" ||
          (Array.isArray(type) && (type.includes("Restaurant") || type.includes("FoodEstablishment")));
        if (isRestaurant) return node;
      }
    }
    return null;
  }

  // Opportunistic: schema.org supports Menu -> MenuSection -> MenuItem, but it's optional and
  // inconsistently implemented — OpenTable's business is reservations, not online ordering, so
  // there's no confirmation it ships this. Costs nothing to try; returns false if absent so the
  // caller knows to fall back to (currently unbuilt) DOM-based menu extraction instead.
  function extractMenuItemsFromJsonLd(node, push) {
    const menu = node.hasMenu || node.menu;
    if (!menu) return false;

    let found = false;
    for (const m of Array.isArray(menu) ? menu : [menu]) {
      const sections = m.hasMenuSection
        ? Array.isArray(m.hasMenuSection)
          ? m.hasMenuSection
          : [m.hasMenuSection]
        : [m]; // some feeds skip sections and put hasMenuItem directly on the Menu
      for (const section of sections) {
        if (!section.hasMenuItem) continue;
        for (const item of Array.isArray(section.hasMenuItem) ? section.hasMenuItem : [section.hasMenuItem]) {
          if (!item.name) continue;
          const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
          const price = offer?.price;
          const label = price ? `${item.name} ($${price})` : item.name;
          push("menu-item", "Menu item", item.description ? `${label} — ${item.description}` : label);
          found = true;
        }
      }
    }
    return found;
  }

  // DOM fallback for menu items (verified against a live page via manual diagnostic — curl/
  // WebFetch both time out against opentable.com, so this couldn't be automated). Deliberately
  // matches on structure (h4 with a price, inside an li, inside a ul with 3+ siblings) rather
  // than the page's actual class names, which look like CSS-module content hashes
  // (e.g. "iC5T-7C2eyc-") likely to change on OpenTable's next deploy.
  //
  // Unlike the synthetic facts panel, this tags the real <li> menu-item elements in place, so
  // matching dishes get highlighted directly on the visible menu rather than duplicated into a
  // summary list.
  const MAX_MENU_ITEMS = 40;
  const PRICE_RE = /\$\s?\d+(?:\.\d{2})?/;

  function extractMenuItemsFromDom(items) {
    const seen = new Set();
    let count = 0;

    for (const h4 of document.querySelectorAll("li h4")) {
      if (count >= MAX_MENU_ITEMS) break;

      const headingText = normalize(h4.textContent);
      if (!PRICE_RE.test(headingText)) continue; // not a priced item heading

      const li = h4.closest("li");
      if (!li || seen.has(li)) continue;
      if (li.parentElement?.closest("li")) continue; // skip nested modifier/option sub-lists

      const ul = li.closest("ul");
      if (!ul || ul.children.length < 3) continue; // require a real repeating list, not a one-off

      seen.add(li);

      const priceMatch = headingText.match(PRICE_RE);
      const price = priceMatch ? parseFloat(priceMatch[0].replace(/[^0-9.]/g, "")) : null;
      const name = normalize(headingText.replace(PRICE_RE, ""));
      if (!name) continue;

      const descEl = Array.from(li.querySelectorAll("p, span")).find(
        (el) => !h4.contains(el) && el !== h4 && normalize(el.textContent).length > 15
      );
      const desc = descEl ? normalize(descEl.textContent) : "";
      const label = price !== null ? `${name} ($${price.toFixed(2)})` : name;

      const id = `ll-m-${count}`;
      li.setAttribute("data-ll-id", id);
      items.push({
        id,
        title: desc ? `${label} — ${desc}` : label,
        kind: "menu-item",
        price: null,
        rating: null,
        reviewCount: null,
        prime: null,
        sponsored: false,
      });
      count++;
    }

    return count > 0;
  }

  function addFactRow(panel, id, label, value) {
    const row = document.createElement("div");
    row.className = "ll-fact-row";
    row.setAttribute("data-ll-id", id);

    const labelEl = document.createElement("span");
    labelEl.className = "ll-fact-label";
    labelEl.textContent = label;

    const valueEl = document.createElement("span");
    valueEl.className = "ll-fact-value";
    valueEl.textContent = value;

    row.appendChild(labelEl);
    row.appendChild(valueEl);
    panel.appendChild(row);
    return row;
  }

  function extract() {
    const node = findRestaurantNode();
    if (!node) {
      console.warn("IntentLink[opentable]: no Restaurant JSON-LD found on this page");
      return [];
    }

    const panel = document.createElement("div");
    panel.id = "ll-facts";
    document.body.prepend(panel); // content.js prepends #ll-bar after extract() runs, ending up above this

    const items = [];
    let n = 0;
    function push(kind, label, value) {
      const text = normalize(value);
      if (!text) return;
      const id = `ll-${n++}`;
      addFactRow(panel, id, label, text);
      items.push({
        id,
        title: `${label}: ${text}`,
        kind,
        price: null,
        rating: null,
        reviewCount: null,
        prime: null,
        sponsored: false,
      });
    }

    push("fact", "Cuisine", Array.isArray(node.servesCuisine) ? node.servesCuisine.join(", ") : node.servesCuisine);
    push("fact", "Price range", node.priceRange);
    if (node.aggregateRating) {
      push(
        "fact",
        "Rating",
        `${node.aggregateRating.ratingValue}★ (${node.aggregateRating.reviewCount} reviews)`
      );
    }
    if (node.address && typeof node.address === "object") {
      const loc = [node.address.streetAddress, node.address.addressLocality, node.address.addressRegion]
        .filter(Boolean)
        .join(", ");
      push("fact", "Location", loc);
    }
    push("fact", "Description", node.description);

    // Opportunistic: some sites embed individual Review objects (with real review text) directly
    // in the JSON-LD for SEO rich snippets. If present, no DOM scraping needed for these either.
    if (Array.isArray(node.review)) {
      node.review.slice(0, MAX_REVIEWS).forEach((r) => {
        const text = r.reviewBody || r.description;
        if (text) push("review", "Review", text.slice(0, MAX_REVIEW_CHARS));
      });
    }

    let foundMenuItems = extractMenuItemsFromJsonLd(node, push);
    if (!foundMenuItems) {
      foundMenuItems = extractMenuItemsFromDom(items);
    }

    if (!items.length) {
      panel.remove();
      console.warn("IntentLink[opentable]: Restaurant JSON-LD found but no usable fields in it");
      return [];
    }

    console.log(`IntentLink[opentable]: extracted ${items.length} item(s)`, items);
    if (!Array.isArray(node.review) || !node.review.length) {
      console.log(
        "IntentLink[opentable]: no individual reviews in JSON-LD — only aggregate rating is available; " +
          "real review-text extraction would need DOM selectors verified against a live page"
      );
    }
    if (!foundMenuItems) {
      console.warn(
        "IntentLink[opentable]: no menu items found via JSON-LD or the h4-in-li-in-ul DOM " +
          "pattern — the Menu tab may not have been rendered yet, or its structure differs from " +
          "what was calibrated (see adapters/opentable-restaurant.js)"
      );
    }
    return items;
  }

  window.LL_ADAPTER = {
    extract,
    clutterSelectors: [],
    pageType: "product",
    promote: false, // a facts panel has a deliberate reading order, not a list to reorder
  };
})();
