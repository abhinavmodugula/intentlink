// Amazon product-detail-page (PDP) adapter. Exposes window.LL_ADAPTER.
// Unlike the search adapter, there's no list of competing products to rank — there's one
// product and a page full of supporting facts (feature bullets, spec rows, review snippets).
// Each fact becomes an "item" so the existing keep/dim/chip pipeline in content.js can decide
// which facts are the evidence for why this product matches the stated intent.
// No model calls here — pure DOM extraction, tolerant of a couple of layout variants per field.
(function () {
  // Search and product-detail adapters share this content-script bundle and self-guard on
  // mutually exclusive URL shapes, so only one of them ever registers window.LL_ADAPTER.
  function isProductPage() {
    return /\/(dp|gp\/product|product)\//.test(location.pathname);
  }
  if (!isProductPage()) return;

  const MAX_BULLETS = 20;
  const MAX_SPECS = 20;
  const MAX_REVIEWS = 5;
  const MAX_REVIEW_CHARS = 400;

  // Amazon PDPs carry a lot of cross-sell, ad, and promo chrome around the actual product
  // facts. Hidden (not dimmed) because it's reversible — Reset sweeps every .ll-hide node back.
  // None of these touch the title/images/buy box/bullets/specs/reviews, which must stay.
  const CLUTTER_SELECTORS = [
    // Sponsored / ads — the attribute selector catches most ad slots generically.
    "[cel_widget_id*='sponsored' i]",
    "#sp_detail",
    "#sp_detail2",
    "#dealsAccordion_feature_div",
    "#psgProductPlacement_feature_div",

    // Cross-sell / "related items" carousels — upsell, not evidence for this product.
    "#similarities_feature_div",
    "#HLCXComparisonWidget_feature_div",
    "#sims-consolidated-1_feature_div",
    "#sims-consolidated-2_feature_div",
    "#sims-consolidated-3_feature_div",
    "#fbt_feature_div",
    "#outfit-sim_feature_div",
    ".a-carousel-container",

    // Amazon's own AI "Customers say" summary — overlaps/competes with our answer card.
    "#social-proofing-faceout_feature_div",

    // Q&A, badges, and promos — not facts about whether the product fits the stated intent.
    "#askATFLink_feature_div",
    "#ask-btf_feature_div",
    "#climatePledgeFriendly_feature_div",
    "#amazonGlobal_feature_div",
    "#creditCardTradeInOffer_feature_div",
    "#va-related-videos-widget_feature_div",
  ];

  let nextId = 0;
  const seenText = new Set();

  function normalize(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function isVisible(node) {
    return !!node && !node.closest(".aok-hidden") && node.offsetParent !== null;
  }

  // Tags `node` with a fresh data-ll-id and pushes a {id, title, kind, ...nulls} item,
  // de-duping on normalized text so overview + detail-bullet duplicates aren't highlighted twice.
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

  // Amazon runs several PDP layout variants across categories/A-B tests, so each fact type
  // tries a handful of known container ids rather than a single one — if a page uses the
  // classic tech-spec table instead of the newer "product overview" cards (or vice versa),
  // extraction still finds something instead of silently coming back empty.
  const BULLET_SELECTOR = [
    "#feature-bullets ul li",
    "#feature-bullets li",
    "[data-feature-name='featurebullets'] li",
    "#productFactsDesktopExpander li",
    "#productFactsAccordionExpander li",
  ].join(", ");

  const SPEC_ROW_SELECTOR = [
    "#productOverview_feature_div table tr",
    "#productDetails_techSpec_section_1 tr",
    "#productDetails_detailBullets_sections1 tr",
    "table.prodDetTable tr",
  ].join(", ");

  const SPEC_LIST_SELECTOR = [
    "#detailBullets_feature_div li",
    "#detailBulletsWrapper_feature_div li",
  ].join(", ");

  function extractBullets(items) {
    const nodes = document.querySelectorAll(BULLET_SELECTOR);
    for (const node of nodes) {
      if (items.length >= MAX_BULLETS) break;
      if (!isVisible(node)) continue;
      pushItem(items, node, node.textContent, "bullet");
    }
  }

  function extractSpecRows(items) {
    let count = 0;
    const rows = document.querySelectorAll(SPEC_ROW_SELECTOR);
    for (const row of rows) {
      if (count >= MAX_SPECS) break;
      if (!isVisible(row)) continue;
      const cells = row.querySelectorAll("td, th");
      if (cells.length < 2) continue;
      const label = normalize(cells[0].textContent);
      const value = normalize(cells[1].textContent);
      if (!label || !value) continue;
      pushItem(items, row, `${label}: ${value}`, "spec");
      count++;
    }

    const listRows = document.querySelectorAll(SPEC_LIST_SELECTOR);
    for (const row of listRows) {
      if (count >= MAX_SPECS) break;
      if (!isVisible(row)) continue;
      pushItem(items, row, row.textContent, "spec");
      count++;
    }
  }

  function extractReviews(items) {
    const nodes = document.querySelectorAll(
      '#cm-cr-dp-review-list [data-hook="review"]'
    );
    let count = 0;
    for (const node of nodes) {
      if (count >= MAX_REVIEWS) break;
      if (!isVisible(node)) continue;
      const bodyEl = node.querySelector('[data-hook="review-body"]');
      if (!bodyEl) continue;
      const text = normalize(bodyEl.textContent).slice(0, MAX_REVIEW_CHARS);
      if (!text) continue;
      pushItem(items, node, text, "review");
      count++;
    }
  }

  function extract() {
    const items = [];
    extractBullets(items);
    const afterBullets = items.length;
    extractSpecRows(items);
    const afterSpecs = items.length;
    extractReviews(items); // best-effort: reviews often aren't in the DOM yet at document_idle
    console.log(
      `IntentLink[amazon-product]: extracted ${items.length} item(s) — ` +
        `${afterBullets} bullet(s), ${afterSpecs - afterBullets} spec(s), ${items.length - afterSpecs} review(s)`
    );
    return items;
  }

  window.LL_ADAPTER = {
    extract,
    clutterSelectors: CLUTTER_SELECTORS,
    pageType: "product",
    promote: false, // highlight facts in place; a PDP has no "list" to reorder
    // Exposed so content.js can retry review extraction once they lazy-load in.
    extractReviews,
  };
})();
