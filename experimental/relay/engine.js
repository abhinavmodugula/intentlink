// Orchestration: turns an intent string into a full layout decision for both the Features
// deck and the Spotlight section, using a single batched Jev call. Pure function of
// (intent, cards, spotlight) -> layout; no DOM work happens here (see render.js).
window.RelayEngine = (function () {
  // Prominence bands, mirrored from engines/jev.js's KEEP_THRESHOLD (0.3) / content.js's
  // ll-keep (>=0.8) cut points, split into one more tier for a 4-band hero/standard/compact/drop.
  const HERO_MIN = 0.85;
  const STANDARD_MIN = 0.6;
  const COMPACT_MIN = 0.3;
  const CONFLICT_MIN = 0.6;

  function bandFor(relScore) {
    if (typeof relScore !== "number") return "standard";
    if (relScore >= HERO_MIN) return "hero";
    if (relScore >= STANDARD_MIN) return "standard";
    if (relScore >= COMPACT_MIN) return "compact";
    return "dropped";
  }

  function buildQuestions(intent, cards, spotlight) {
    const questions = {};
    for (const card of cards) {
      questions[`${card.id}:rel`] =
        `Is this feature relevant or appealing to this reader? Reader's stated intent: "${intent}". Feature: "${card.summary}"`;
      questions[`${card.id}:conflict`] =
        `Is this feature irrelevant or off-putting to this specific reader, given their stated intent? Reader's stated intent: "${intent}". Feature: "${card.summary}"`;
      for (const variant of card.variants) {
        questions[`${card.id}:var:${variant.id}`] =
          `Does this framing fit how this reader thinks about the product? Reader's stated intent: "${intent}". Framing: "${variant.blurb}"`;
      }
    }
    for (const panel of spotlight) {
      questions[`spot:${panel.id}:rel`] =
        `Is this deep-dive exactly what this reader is asking for right now? Reader's stated intent: "${intent}". Deep-dive: "${panel.summary}"`;
    }
    return questions;
  }

  function defaultLayout(cards, spotlight) {
    // Neutral layout for an empty intent or a failed Jev call: everything standard, in deck
    // order, first variant of each card, first Spotlight panel leading.
    return {
      cards: cards.map((card) => ({
        card,
        band: "standard",
        variant: card.variants[0],
        score: null,
      })),
      spotlightId: spotlight[0]?.id ?? null,
    };
  }

  async function computeLayout(intent, cards, spotlight) {
    const trimmed = (intent || "").trim();
    if (!trimmed) return defaultLayout(cards, spotlight);

    const questions = buildQuestions(trimmed, cards, spotlight);
    const scores = await window.RelayJev.ask(questions, { intent: trimmed });
    if (!scores) return null; // superseded by a newer keystroke; caller should ignore

    const results = [];
    for (const card of cards) {
      const relScore = scores[`${card.id}:rel`];
      const conflictScore = scores[`${card.id}:conflict`];
      let band = bandFor(relScore);
      if (typeof conflictScore === "number" && conflictScore >= CONFLICT_MIN) {
        band = band === "hero" ? "standard" : "dropped";
      }

      let bestVariant = card.variants[0];
      let bestVariantScore = -Infinity;
      for (const variant of card.variants) {
        const vScore = scores[`${card.id}:var:${variant.id}`];
        if (typeof vScore === "number" && vScore > bestVariantScore) {
          bestVariantScore = vScore;
          bestVariant = variant;
        }
      }

      results.push({ card, band, variant: bestVariant, score: relScore ?? null });
    }

    results.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    let spotlightId = spotlight[0]?.id ?? null;
    let bestSpotScore = -Infinity;
    for (const panel of spotlight) {
      const sScore = scores[`spot:${panel.id}:rel`];
      if (typeof sScore === "number" && sScore > bestSpotScore) {
        bestSpotScore = sScore;
        spotlightId = panel.id;
      }
    }

    return { cards: results, spotlightId, scores };
  }

  return { computeLayout, bandFor, HERO_MIN, STANDARD_MIN, COMPACT_MIN, CONFLICT_MIN };
})();
