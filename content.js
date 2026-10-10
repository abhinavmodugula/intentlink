// Reads #ll-intent, extracts units via the page's adapter, and reshapes the page in two passes
// (F2, F7, F8, F9). Only ever toggles classes / adds the summary bar — the page's own HTML
// (aside from reordering a kept item to the front) is never rewritten, so a failure leaves the
// normal page behind.
(function () {
  const CLASS_NAMES = ["ll-keep", "ll-dim", "ll-hide", "ll-pending", "ll-maybe", "ll-promote"];

  const state = {
    intent: null,
    items: null,
    nodesById: new Map(),
    container: null,
    startTime: 0,
    bar: null,
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

  function hideClutter() {
    if (!window.LL_ADAPTER) return;
    for (const sel of window.LL_ADAPTER.clutterSelectors) {
      document.querySelectorAll(sel).forEach((node) => node.classList.add("ll-hide"));
    }
  }

  // Pass 1 (F7): instant, pure JS. Only ever hides adapter-marked clutter and dims a provable
  // numeric/boolean constraint failure. Everything else stays ll-pending (neutral, fully readable).
  function applyPass1(intent, items) {
    const filters = window.LL_FILTERS.parseConstraints(intent);
    hideClutter();

    let pendingCount = 0;
    for (const item of items) {
      const node = state.nodesById.get(item.id);
      if (!node) continue;
      clearLLClasses(node);
      removeChip(node);

      if (item.sponsored) {
        node.classList.add("ll-hide");
        continue;
      }
      if (!window.LL_FILTERS.passesFilters(item, filters)) {
        node.classList.add("ll-dim");
        continue;
      }
      node.classList.add("ll-pending");
      pendingCount++;
    }

    return { filters, pendingCount };
  }

  // Pass 2 (F7): settles every pending item into keep / maybe / dim once rank() returns.
  function applyPass2(plan) {
    const keepMap = new Map(plan.keep.map((k) => [k.id, k]));
    const keptNodesInOrder = [];

    for (const item of state.items) {
      const node = state.nodesById.get(item.id);
      if (!node || item.sponsored) continue; // sponsored stays ll-hide regardless of the plan

      const kept = keepMap.get(item.id);
      node.classList.remove("ll-pending", "ll-dim", "ll-keep", "ll-maybe");
      removeChip(node);

      if (!kept) {
        node.classList.add("ll-dim");
        continue;
      }

      const score = typeof kept.score === "number" ? kept.score : 1;
      if (score >= 0.8) {
        node.classList.add("ll-keep");
        keptNodesInOrder.push(node);
      } else {
        node.classList.add("ll-maybe");
        keptNodesInOrder.push(node);
      }
      addChip(node, kept.reason);
    }

    promoteKept(keptNodesInOrder);
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

  async function runRank(intent, items) {
    try {
      const res = await chrome.runtime.sendMessage({ type: "rank", intent, items });
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
      `${pendingCount} of ${state.items.length} match the filters · refining…`,
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
    }
    // Clutter nodes (sponsored results, carousels) aren't in nodesById — sweep them separately.
    document.querySelectorAll(".ll-hide").forEach((n) => n.classList.remove("ll-hide"));
    if (state.bar) {
      state.bar.remove();
      state.bar = null;
    }
  }

  async function init() {
    let intent = decodeIntentFromHash(location.hash);

    if (!intent) {
      // F3 backup: a redirect may have dropped the fragment before this script ever saw it.
      try {
        const res = await chrome.runtime.sendMessage({ type: "getCapturedIntent" });
        intent = res?.intent || null;
      } catch {
        // no background available / no capture — fall through to "do nothing"
      }
    }

    if (!intent) return; // F2: pages without an intent are left untouched
    if (!window.LL_ADAPTER) return; // no adapter for this domain

    const items = window.LL_ADAPTER.extract();
    if (!items.length) return;

    state.items = items;
    state.nodesById = new Map(
      items.map((it) => [it.id, document.querySelector(`[data-ll-id="${it.id}"]`)])
    );
    state.bar = buildBar();

    runReshape(intent);
  }

  init();
})();
