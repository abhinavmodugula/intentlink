// Reads #ll-intent, extracts units via the page's adapter, and reshapes the page in two passes
// (F2, F7, F8, F9). Only ever toggles classes / adds the summary bar — the page's own HTML
// (aside from reordering a kept item to the front) is never rewritten, so a failure leaves the
// normal page behind.
(function () {
  const CLASS_NAMES = ["ll-keep", "ll-dim", "ll-hide", "ll-pending", "ll-maybe", "ll-promote", "ll-best"];

  const state = {
    intent: null,
    items: null,
    nodesById: new Map(),
    container: null,
    startTime: 0,
    bar: null,
    answer: null,
    pageType: "search",
  };

  function decodeIntentFromHash(hash) {
    const m = hash.match(/#ll-intent=([^&]*)/);
    if (!m) return null;
    const raw = m[1].replace(/\+/g, " ");
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw; // tolerant decode (F2): never throw on a malformed fragment
    }
  }

  function clearLLClasses(node) {
    node.classList.remove(...CLASS_NAMES);
  }

  function removeChip(node) {
    const chip = node.querySelector(":scope > .ll-chip");
    if (chip) chip.remove();
  }

  function addChip(node, reason) {
    removeChip(node);
    if (!reason) return;
    const chip = document.createElement("div");
    chip.className = "ll-chip";
    chip.textContent = reason;
    node.appendChild(chip);
  }

  function removeBestBadge(node) {
    const badge = node.querySelector(":scope > .ll-best-badge");
    if (badge) badge.remove();
  }

  function addBestBadge(node) {
    removeBestBadge(node);
    const badge = document.createElement("div");
    badge.className = "ll-best-badge";
    badge.textContent = "★ Best match";
    node.prepend(badge);
  }

  // Product-page declutter (F7, product mode only): rather than enumerate every noisy Amazon
  // module by id (brittle — Amazon adds/renames/A-B-tests these constantly), hide every
  // "*_feature_div" module page-wide EXCEPT ones that hold something that must stay visible:
  // an extracted fact (tagged data-ll-id by the adapter), the image gallery, the buy box, or
  // the title. Containment-based in both directions (closest = is-it-inside-one,
  // querySelector = does-it-contain-one) so it holds regardless of the exact wrapper ids
  // Amazon's current A/B-tested layout uses. Re-run every pass so a container that gains
  // protected content later (e.g. reviews lazy-loading in) un-hides instead of staying hidden.
  const PRODUCT_NEVER_HIDE_SELECTOR = [
    "[data-ll-id]",
    "#imageBlock_feature_div",
    "#imgTagWrapperId",
    "#altImages",
    "#rightCol",
    "#buybox_feature_div",
    "#addToCart_feature_div",
    "#title_feature_div",
  ].join(", ");

  function hideNonEssentialProductModules() {
    document.querySelectorAll('[id$="_feature_div"]').forEach((node) => {
      const protect = node.closest(PRODUCT_NEVER_HIDE_SELECTOR) || node.querySelector(PRODUCT_NEVER_HIDE_SELECTOR);
      node.classList.toggle("ll-hide", !protect);
    });
  }

  function hideClutter() {
    if (!window.LL_ADAPTER) return;
    for (const sel of window.LL_ADAPTER.clutterSelectors) {
      document.querySelectorAll(sel).forEach((node) => node.classList.add("ll-hide"));
    }
    if (state.pageType === "product") {
      hideNonEssentialProductModules();
    }
  }

  // Pass 1 (F7): instant, pure JS. Only ever hides adapter-marked clutter and dims a provable
  // numeric/boolean constraint failure. Everything else stays ll-pending (neutral, fully readable).
  function applyPass1(intent, items) {
    const filters = window.LL_FILTERS.parseConstraints(intent);
    hideClutter();

    // On a product page there's no "list" to preserve for context — a fact that fails pass 1
    // is just noise, so it's fully hidden rather than dimmed. Search keeps dimming (ll-dim) so
    // the filtered-out results stay visible for context.
    const failClass = state.pageType === "product" ? "ll-hide" : "ll-dim";

    let pendingCount = 0;
    for (const item of items) {
      const node = state.nodesById.get(item.id);
      if (!node) continue;
      clearLLClasses(node);
      removeChip(node);
      removeBestBadge(node);

      if (item.sponsored) {
        node.classList.add("ll-hide");
        continue;
      }
      if (!window.LL_FILTERS.passesFilters(item, filters)) {
        node.classList.add(failClass);
        continue;
      }
      node.classList.add("ll-pending");
      pendingCount++;
    }

    return { filters, pendingCount };
  }

  // Pass 2 (F7): settles every pending item into keep / maybe / dim once rank() returns.
  // Exactly one item (the highest-scoring kept item, if any) gets the "Best match" badge —
  // this never overrides F6: a best match can only be chosen from items the plan already kept,
  // so it can never be something that violates a stated filter.
  function applyPass2(plan) {
    const keepMap = new Map(plan.keep.map((k) => [k.id, k]));
    const keptNodesInOrder = [];

    let bestId = null;
    let bestScore = -Infinity;
    for (const k of plan.keep) {
      const score = typeof k.score === "number" ? k.score : 1;
      if (score > bestScore) {
        bestScore = score;
        bestId = k.id;
      }
    }

    for (const item of state.items) {
      const node = state.nodesById.get(item.id);
      if (!node || item.sponsored) continue; // sponsored stays ll-hide regardless of the plan

      const kept = keepMap.get(item.id);
      node.classList.remove("ll-pending", "ll-dim", "ll-hide", "ll-keep", "ll-maybe", "ll-best");
      removeChip(node);
      removeBestBadge(node);

      if (!kept) {
        // Product pages: only the relevant facts should remain — hide the rest outright rather
        // than dim them. Search keeps dimming so filtered-out results stay visible for context.
        node.classList.add(state.pageType === "product" ? "ll-hide" : "ll-dim");
        continue;
      }

      const score = typeof kept.score === "number" ? kept.score : 1;
      node.classList.add(score >= 0.8 ? "ll-keep" : "ll-maybe");
      keptNodesInOrder.push(node);
      addChip(node, kept.reason);

      if (item.id === bestId) {
        node.classList.add("ll-best");
        addBestBadge(node);
      }
    }

    // Lead the promoted group with the best match, if there is one.
    if (bestId) {
      const bestNode = state.nodesById.get(bestId);
      const idx = keptNodesInOrder.indexOf(bestNode);
      if (idx > 0) {
        keptNodesInOrder.splice(idx, 1);
        keptNodesInOrder.unshift(bestNode);
      }
    }

    // A product page has no list to reorder — facts stay exactly where they are on the page.
    if (window.LL_ADAPTER.promote !== false) {
      promoteKept(keptNodesInOrder);
    }
  }

  // Best-effort "promote" op: bubble kept items to the front of their shared parent, preserving
  // their relative order. Wrapped so a layout surprise never breaks the page.
  function promoteKept(nodesInOrder) {
    try {
      if (!nodesInOrder.length) return;
      const container = nodesInOrder[0].parentElement;
      if (!container) return;
      for (const node of nodesInOrder) {
        if (node.parentElement !== container) return; // not a uniform sibling set — skip, non-fatal
      }
      let anchor = container.firstElementChild;
      for (const node of nodesInOrder) {
        if (node !== anchor) container.insertBefore(node, anchor);
        anchor = node.nextElementSibling;
      }
    } catch (e) {
      console.warn("IntentLink: promote skipped", e);
    }
  }

  function buildBar() {
    const bar = document.createElement("div");
    bar.id = "ll-bar";
    bar.innerHTML = `
      <span class="ll-summary"><span class="ll-spinner"></span>Reshaping…</span>
      <input class="ll-refine" type="text" placeholder="Refine, e.g. &quot;only over-ear&quot;" />
      <span class="ll-latency"></span>
      <button class="ll-reset" type="button">Reset</button>
    `;
    document.body.prepend(bar);

    bar.querySelector(".ll-refine").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.value.trim()) {
        runRefine(e.target.value.trim());
        e.target.value = "";
      }
    });
    bar.querySelector(".ll-reset").addEventListener("click", resetPage);

    return bar;
  }

  function setSummary(text, { spinner = false } = {}) {
    if (!state.bar) return;
    const el = state.bar.querySelector(".ll-summary");
    el.innerHTML = spinner ? `<span class="ll-spinner"></span>${text}` : text;
  }

  function setLatency(ms) {
    if (!state.bar) return;
    state.bar.querySelector(".ll-latency").textContent = `${Math.round(ms)} ms`;
  }

  // Pinned "Recommended because: …" card, product pages only — there's one product, so the
  // useful summary is the evidence for it, not a match count.
  function setAnswerCard(text) {
    if (state.pageType !== "product") return;
    if (!text) {
      if (state.answer) {
        state.answer.remove();
        state.answer = null;
      }
      return;
    }
    if (!state.answer) {
      state.answer = document.createElement("div");
      state.answer.id = "ll-answer";
      if (state.bar) state.bar.insertAdjacentElement("afterend", state.answer);
      else document.body.prepend(state.answer);
    }
    state.answer.textContent = `Recommended because: ${text}`;
  }

  async function runRank(intent, items) {
    try {
      const res = await chrome.runtime.sendMessage({
        type: "rank",
        intent,
        items,
        pageType: state.pageType,
      });
      if (!res?.ok) throw new Error(res?.error || "rank failed");
      return res.plan;
    } catch (e) {
      console.warn("IntentLink: rank message failed", e);
      return null;
    }
  }

  async function runReshape(intent) {
    state.intent = intent;
    state.startTime = performance.now();

    const { pendingCount } = applyPass1(intent, state.items);
    setSummary(
      state.pageType === "product"
        ? "Finding why this was recommended…"
        : `${pendingCount} of ${state.items.length} match the filters · refining…`,
      { spinner: true }
    );

    const plan = await runRank(intent, state.items);
    if (!plan) {
      setSummary("filtered locally");
      setLatency(performance.now() - state.startTime);
      return;
    }

    applyPass2(plan);
    setSummary(plan.summary || "");
    setAnswerCard(plan.summary || "");
    setLatency(performance.now() - state.startTime);
  }

  function runRefine(refinementText) {
    const combined = `${state.intent} / ${refinementText}`;
    runReshape(combined);
  }

  function resetPage() {
    for (const node of state.nodesById.values()) {
      clearLLClasses(node);
      removeChip(node);
      removeBestBadge(node);
    }
    // Clutter nodes (sponsored results, carousels) aren't in nodesById — sweep them separately.
    document.querySelectorAll(".ll-hide").forEach((n) => n.classList.remove("ll-hide"));
    if (state.answer) {
      state.answer.remove();
      state.answer = null;
    }
    if (state.bar) {
      state.bar.remove();
      state.bar = null;
    }
  }

  // Reviews are often lazy-loaded and absent at document_idle. Best-effort only: give the review
  // list ~2s to render, re-extract once, and fold any new facts into the running reshape. Absence
  // never blocks or breaks the bullet/spec reshape.
  function watchForLazyReviews() {
    if (state.pageType !== "product") return;
    const adapter = window.LL_ADAPTER;
    if (!adapter || typeof adapter.extractReviews !== "function") return;

    const container = document.querySelector("#cm-cr-dp-review-list");
    if (!container) return;

    const timer = setTimeout(() => observer.disconnect(), 2000);
    const observer = new MutationObserver(() => {
      const extra = [];
      adapter.extractReviews(extra);
      if (!extra.length) return;

      clearTimeout(timer);
      observer.disconnect();
      for (const item of extra) {
        state.items.push(item);
        state.nodesById.set(item.id, document.querySelector(`[data-ll-id="${item.id}"]`));
      }
      runReshape(state.intent);
    });
    observer.observe(container, { childList: true, subtree: true });
  }

  async function init() {
    let intent = decodeIntentFromHash(location.hash);
    console.log(`IntentLink: location.hash at document_idle = "${location.hash}" -> intent ${intent ? "FOUND directly" : "not found"}`);

    if (!intent) {
      // F3 backup: a redirect may have dropped the fragment before this script ever saw it.
      try {
        const res = await chrome.runtime.sendMessage({ type: "getCapturedIntent" });
        intent = res?.intent || null;
        console.log(`IntentLink: getCapturedIntent fallback -> ${intent ? `FOUND: "${intent}"` : "nothing captured"}`);
      } catch (e) {
        console.warn("IntentLink: getCapturedIntent message failed", e);
      }
    }

    if (!intent) {
      console.warn("IntentLink: no intent found via hash or capture fallback — doing nothing on this page");
      return; // F2: pages without an intent are left untouched
    }
    if (!window.LL_ADAPTER) {
      console.warn("IntentLink: intent found but no adapter registered window.LL_ADAPTER for this page");
      return; // no adapter for this domain
    }

    state.pageType = window.LL_ADAPTER.pageType || "search";
    const items = window.LL_ADAPTER.extract();

    if (!items.length) {
      // Search: an empty extraction usually means this isn't actually a results page — stay
      // silent (F2). Product: the adapter matched this URL but found no bullets/specs/reviews
      // (likely an unrecognized PDP layout) — show the bar so a failure is visible, not silent.
      if (state.pageType !== "product") return;
      state.bar = buildBar();
      setSummary("Couldn't find supported sections on this page.");
      console.warn("IntentLink: product adapter matched the URL but extracted 0 items");
      return;
    }

    state.items = items;
    state.nodesById = new Map(
      items.map((it) => [it.id, document.querySelector(`[data-ll-id="${it.id}"]`)])
    );
    state.bar = buildBar();

    runReshape(intent);
    watchForLazyReviews();
  }

  init();
})();
