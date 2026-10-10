// Craigslist individual-posting adapter (one listing, not a list — "product" page contract, see
// adapters/amazon-product.js). Verified directly against a live posting via curl (Craigslist has
// no bot-wall, unlike uniqlo.com/opentable.com): plain, unhashed, classic server-rendered HTML.
//
// Each fact becomes an "item" so the existing keep/dim/chip pipeline decides which facts are
// evidence the listing matches the stated intent — mirroring amazon-product.js's bullets/specs.
// Sources, in order of how reliable/structured they are:
//   .attrgroup .attr      bed/bath/sqft + amenity tags (pets, parking, laundry, EV charging...)
//   .price                 rent
//   #postingbody ul li      "Unit Amenities" / "Community Amenities" bullet lists
(function () {
  function isCraigslistPostingPage() {
    if (!/(^|\.)craigslist\.org$/.test(location.hostname)) return false;
    return /\/d\//.test(location.pathname); // covers both /view/d/<slug>/<id> and /<region>/<cat>/d/<slug>/<id>.html
  }
  if (!isCraigslistPostingPage()) return;
  if (window.LL_ADAPTER) return;

  const MAX_ATTRS = 20;
  const MAX_BULLETS = 30;

  let nextId = 0;
  const seenText = new Set();

  function normalize(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  // Tags `node` with a fresh data-ll-id and pushes an item, de-duping on normalized text.
  function pushItem(items, node, text, kind, price) {
    const title = normalize(text);
    if (!title || seenText.has(title)) return;
    seenText.add(title);

    const id = `ll-${nextId++}`;
    node.setAttribute("data-ll-id", id);
    items.push({
      id,
      title,
      kind,
      price: price ?? null,
      rating: null,
      reviewCount: null,
      prime: null,
      sponsored: false,
    });
  }

  function extractAttrs(items) {
    const attrs = document.querySelectorAll(".attrgroup .attr");
    let count = 0;
    for (const attrEl of attrs) {
      if (count >= MAX_ATTRS) break;
      const linkText = attrEl.querySelector(".valu a")?.textContent;
      const text = normalize(linkText || attrEl.textContent);
      if (!text) continue;
      pushItem(items, attrEl, text, "attr");
      count++;
    }
  }

  function extractPrice(items) {
    const priceEl = document.querySelector(".price");
    if (!priceEl) return;
    const n = parseFloat(priceEl.textContent.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(n)) return;
    pushItem(items, priceEl, `Rent: ${normalize(priceEl.textContent)}`, "fact", n);
  }

  function extractAmenityBullets(items) {
    const body = document.querySelector("#postingbody");
    if (!body) return;
    let count = 0;
    for (const li of body.querySelectorAll("ul li")) {
      if (count >= MAX_BULLETS) break;
      const text = normalize(li.textContent);
      if (!text) continue;
      pushItem(items, li, text, "bullet");
      count++;
    }
  }

  function extract() {
    const items = [];
    extractPrice(items);
    const afterPrice = items.length;
    extractAttrs(items);
    const afterAttrs = items.length;
    extractAmenityBullets(items);

    console.log(
      `IntentLink[craigslist-posting]: extracted ${items.length} item(s) — ` +
        `${afterPrice} price, ${afterAttrs - afterPrice} attr(s), ${items.length - afterAttrs} bullet(s)`,
      items
    );
    return items;
  }

  window.LL_ADAPTER = {
    extract,
    clutterSelectors: [],
    pageType: "product",
    promote: false, // a single posting has no list to reorder
  };
})();
