// Standalone Jev client for the Relay demo. Mirrors the request/response contract of the
// extension's engines/jev.js (one "noul" probability question per id, single batched POST)
// but talks to the local /jev proxy instead of api.typesafe.ai directly, so no API key ever
// reaches the browser. Not imported from engines/jev.js — that file binds to a global API key
// and has Amazon-specific prompts; this is a clean reimplementation of the same wire contract.
window.RelayJev = (function () {
  let seq = 0;
  let inFlightController = null;

  // questions: { "<key>": "<instructions string>" }
  // returns: { "<key>": <number 0..1 | undefined> }, or null if superseded by a newer call.
  async function ask(questions, state = {}) {
    const mySeq = ++seq;
    if (inFlightController) inFlightController.abort();
    inFlightController = new AbortController();

    const typedQuestions = {};
    for (const [key, instructions] of Object.entries(questions)) {
      typedQuestions[key] = { type: "noul", instructions };
    }

    const requestBody = {
      model: "jev-latest",
      state: { ...state, questionCount: Object.keys(typedQuestions).length },
      questions: typedQuestions,
    };

    let res;
    try {
      res = await fetch("/jev", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: inFlightController.signal,
      });
    } catch (err) {
      if (err.name === "AbortError") return null; // superseded by a newer keystroke
      throw err;
    }

    if (mySeq !== seq) return null; // a newer call started while we were in flight

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`jev proxy: HTTP ${res.status} ${text}`);
    }

    const data = await res.json();
    if (mySeq !== seq) return null;

    const answers = data && data.answers;
    if (!answers) throw new Error("jev proxy: empty response");

    const scores = {};
    for (const [key, ans] of Object.entries(answers)) {
      scores[key] = typeof ans?.noul === "number" ? ans.noul : undefined;
    }
    return scores;
  }

  return { ask };
})();
