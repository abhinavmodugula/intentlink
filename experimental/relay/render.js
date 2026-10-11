// DOM rendering: builds Features cards, Spotlight panel, FLIP reflow animation, and the
// cost-comparison chart. All layout decisions come from engine.js; this file only draws them.
(function () {
  const grid = document.getElementById("features-grid");
  const spotTabs = document.getElementById("spotlight-tabs");
  const spotPanel = document.getElementById("spotlight-panel");
  const statusEl = document.getElementById("jev-status");
  const debugToggle = document.getElementById("debug-toggle");
  const intentInput = document.getElementById("intent-input");

  const cards = window.RELAY_CARDS;
  const spotlight = window.RELAY_SPOTLIGHT;
  let debugOn = false;
  let currentSpotlightId = spotlight[0]?.id ?? null;

  function cardNode(card) {
    const el = document.createElement("div");
    el.className = "feature-card";
    el.dataset.cardId = card.id;
    el.innerHTML = `
      <div class="feature-icon">${card.icon}</div>
      <h3 class="feature-title">${card.title}</h3>
      <p class="feature-blurb"></p>
      <span class="feature-score"></span>
    `;
    return el;
  }

  // Build all cards once; subsequent renders only reposition/restyle them (needed for FLIP).
  const nodeById = new Map();
  for (const card of cards) {
    const el = cardNode(card);
    nodeById.set(card.id, el);
    grid.appendChild(el);
  }

  for (const panel of spotlight) {
    const tab = document.createElement("button");
    tab.className = "spot-tab";
    tab.textContent = panel.label;
    tab.dataset.panelId = panel.id;
    tab.addEventListener("click", () => {
      currentSpotlightId = panel.id;
      renderSpotlight(panel.id, true);
    });
    spotTabs.appendChild(tab);
  }

  function applyLayout(layoutResult) {
    const rects = new Map();
    for (const [id, el] of nodeById) rects.set(id, el.getBoundingClientRect());

    for (const { card, band, variant, score } of layoutResult.cards) {
      const el = nodeById.get(card.id);
      el.className = `feature-card band-${band}`;
      el.querySelector(".feature-blurb").textContent = variant.blurb;
      const scoreEl = el.querySelector(".feature-score");
      scoreEl.textContent = typeof score === "number" ? `noul: ${score.toFixed(2)}` : "";
      scoreEl.classList.toggle("visible", debugOn && typeof score === "number");
      grid.appendChild(el); // re-append in new sort order
    }

    // FLIP: measure new position, offset back to old, then transition to zero offset.
    for (const [id, el] of nodeById) {
      if (el.classList.contains("band-dropped")) continue;
      const first = rects.get(id);
      const last = el.getBoundingClientRect();
      const dx = first.left - last.left;
      const dy = first.top - last.top;
      if (dx || dy) {
        el.style.transition = "none";
        el.style.transform = `translate(${dx}px, ${dy}px)`;
        requestAnimationFrame(() => {
          el.style.transition = "transform 420ms cubic-bezier(.2,.8,.2,1), opacity 300ms, flex 300ms";
          el.style.transform = "";
        });
      }
    }
  }

  function renderSpotlight(panelId, animate) {
    const panel = spotlight.find((p) => p.id === panelId) || spotlight[0];
    for (const tab of spotTabs.children) {
      tab.classList.toggle("active", tab.dataset.panelId === panel.id);
    }
    if (animate) {
      spotPanel.classList.add("fading");
      setTimeout(() => {
        spotPanel.innerHTML = panel.render();
        spotPanel.classList.remove("fading");
        wirePanelInteractions(panel.id);
      }, 160);
    } else {
      spotPanel.innerHTML = panel.render();
      wirePanelInteractions(panel.id);
    }
  }

  function wirePanelInteractions(panelId) {
    spotPanel.querySelectorAll(".copy-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = document.getElementById(btn.dataset.copy);
        if (!target) return;
        navigator.clipboard?.writeText(target.textContent).then(() => {
          const original = btn.textContent;
          btn.textContent = "Copied";
          setTimeout(() => (btn.textContent = original), 1200);
        });
      });
    });
    if (panelId === "pricing-breakdown") {
      const wrap = document.getElementById("cost-chart-wrap");
      if (wrap) wrap.innerHTML = renderCostChart();
    }
  }

  // --- Cost comparison chart (SVG), palette from the dataviz skill's validated default. ---
  function renderCostChart() {
    const data = [
      { label: "Relay (OSS models)", value: 186, series: "relay" },
      { label: "Claude Code (10 seats)", value: 2000, series: "claude-code" },
      { label: "Cursor (10 seats)", value: 400, series: "cursor" },
    ];
    const max = Math.max(...data.map((d) => d.value));
    const barH = 36;
    const gap = 22;
    const chartW = 560;
    const labelW = 170;
    const barAreaW = chartW - labelW - 70;
    const chartH = data.length * (barH + gap);

    const bars = data
      .map((d, i) => {
        const w = Math.max(2, (d.value / max) * barAreaW);
        const y = i * (barH + gap);
        return `
          <g class="cost-bar-row">
            <text x="0" y="${y + barH / 2 + 4}" class="cost-bar-label">${d.label}</text>
            <rect x="${labelW}" y="${y}" width="${barAreaW}" height="${barH}" class="cost-bar-track" rx="4"/>
            <rect x="${labelW}" y="${y}" width="${w}" height="${barH}" rx="4" class="cost-bar cost-bar--${d.series}"/>
            <text x="${labelW + w + 10}" y="${y + barH / 2 + 4}" class="cost-bar-value">$${d.value.toLocaleString()}/mo</text>
          </g>`;
      })
      .join("");

    return `
      <svg viewBox="0 0 ${chartW} ${chartH + 10}" width="100%" height="${chartH + 10}" class="cost-chart-svg" role="img" aria-label="Monthly cost: Relay 186 dollars, Claude Code 2000 dollars, Cursor 400 dollars">
        ${bars}
      </svg>
      <div class="cost-legend">
        <span class="legend-item"><span class="legend-swatch legend-swatch--relay"></span>Relay (50M in / 10M out tok, Llama 3.3 70B)</span>
        <span class="legend-item"><span class="legend-swatch legend-swatch--claude-code"></span>Claude Code, 10 seats @ list price</span>
        <span class="legend-item"><span class="legend-swatch legend-swatch--cursor"></span>Cursor, 10 seats @ list price</span>
      </div>
    `;
  }

  // --- Orchestration ---
  let requestToken = 0;
  async function recompute() {
    const myToken = ++requestToken;
    const intent = intentInput.value;
    statusEl.textContent = intent.trim() ? "Asking Jev…" : "Showing default layout";
    statusEl.classList.toggle("loading", !!intent.trim());

    let layout;
    try {
      layout = await window.RelayEngine.computeLayout(intent, cards, spotlight);
    } catch (err) {
      console.error("Relay: Jev call failed", err);
      statusEl.textContent = "Jev call failed — showing default layout";
      statusEl.classList.remove("loading");
      return;
    }
    if (!layout || myToken !== requestToken) return; // superseded by a newer keystroke

    applyLayout(layout);
    if (layout.spotlightId && layout.spotlightId !== currentSpotlightId) {
      currentSpotlightId = layout.spotlightId;
      renderSpotlight(layout.spotlightId, true);
    }
    statusEl.textContent = intent.trim() ? "Layout reflects your intent" : "Showing default layout";
    statusEl.classList.remove("loading");
  }

  let debounceTimer = null;
  intentInput.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(recompute, 300);
  });

  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      intentInput.value = chip.dataset.intent;
      intentInput.focus();
      clearTimeout(debounceTimer);
      recompute();
    });
  });

  debugToggle.addEventListener("change", () => {
    debugOn = debugToggle.checked;
    document.querySelectorAll(".feature-score").forEach((el) => {
      el.classList.toggle("visible", debugOn && el.textContent !== "");
    });
  });

  // Initial render: default layout, no Jev call.
  (async function init() {
    const layout = await window.RelayEngine.computeLayout("", cards, spotlight);
    applyLayout(layout);
    renderSpotlight(currentSpotlightId, false);
  })();
})();
