// Spotlight payloads: the hyper-specific, pre-written deep-dives. Jev only scores `summary`
// for relevance (one noul per panel) and picks the lead panel via argmax — all HTML/code/
// numbers below are static and hand-written, never generated.
window.RELAY_SPOTLIGHT = [
  {
    id: "oss-commands",
    label: "Run open-source models",
    summary: "Exact commands to call open-weight models (Llama, Mixtral, Qwen, DeepSeek) through the Relay API — for a developer who wants to use open-source models.",
    render: () => `
      <h3>Run open-source models in 60 seconds</h3>
      <p class="spot-sub">Relay exposes open-weight models through the same OpenAI-compatible endpoint as everything else. Swap the <code>model</code> string, keep your code.</p>

      <div class="code-block">
        <div class="code-head"><span>curl</span><button class="copy-btn" data-copy="curl-oss">Copy</button></div>
        <pre id="curl-oss">curl https://api.relay.dev/v1/chat/completions \\
  -H "Authorization: Bearer $RELAY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "meta-llama/llama-3.3-70b-instruct",
    "messages": [{"role": "user", "content": "Summarize this PR diff."}]
  }'</pre>
      </div>

      <div class="code-block">
        <div class="code-head"><span>Python (openai SDK)</span><button class="copy-btn" data-copy="py-oss">Copy</button></div>
        <pre id="py-oss">from openai import OpenAI

client = OpenAI(
    base_url="https://api.relay.dev/v1",
    api_key=os.environ["RELAY_API_KEY"],
)

resp = client.chat.completions.create(
    model="deepseek/deepseek-r1",
    messages=[{"role": "user", "content": "Summarize this PR diff."}],
)
print(resp.choices[0].message.content)</pre>
      </div>

      <p class="spot-sub">Swap <code>model</code> for any of these — same endpoint, same request shape:</p>
      <table class="model-table">
        <tr><th>Model ID</th><th>Params</th><th>Good for</th></tr>
        <tr><td><code>meta-llama/llama-3.3-70b-instruct</code></td><td>70B</td><td>General purpose, tool calling</td></tr>
        <tr><td><code>mistralai/mixtral-8x7b-instruct</code></td><td>8x7B MoE</td><td>Low-latency, cheap drafting</td></tr>
        <tr><td><code>qwen/qwen-2.5-72b-instruct</code></td><td>72B</td><td>Long context, multilingual</td></tr>
        <tr><td><code>deepseek/deepseek-r1</code></td><td>671B MoE</td><td>Reasoning, code</td></tr>
      </table>
    `,
  },
  {
    id: "deepseek-tutorial",
    label: "Run DeepSeek models",
    summary: "Exact tutorial for calling DeepSeek specifically (deepseek-chat and deepseek-reasoner) through the Relay API, including the reasoning_content field and prompt caching — for a developer who specifically wants to use DeepSeek models, not just open-source models in general.",
    render: () => `
      <h3>Run DeepSeek through Relay</h3>
      <p class="spot-sub">Relay routes <code>deepseek-chat</code> (V3) and <code>deepseek-reasoner</code> (R1) to DeepSeek's own infrastructure behind the same OpenAI-compatible endpoint, so existing client code barely changes.</p>

      <div class="code-block">
        <div class="code-head"><span>curl — deepseek-chat</span><button class="copy-btn" data-copy="curl-ds-chat">Copy</button></div>
        <pre id="curl-ds-chat">curl https://api.relay.dev/v1/chat/completions \\
  -H "Authorization: Bearer $RELAY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "deepseek/deepseek-chat",
    "messages": [{"role": "user", "content": "Write a regex for a US phone number."}],
    "temperature": 0.3
  }'</pre>
      </div>

      <div class="code-block">
        <div class="code-head"><span>Python — deepseek-reasoner (reads reasoning_content)</span><button class="copy-btn" data-copy="py-ds-reason">Copy</button></div>
        <pre id="py-ds-reason">from openai import OpenAI

client = OpenAI(
    base_url="https://api.relay.dev/v1",
    api_key=os.environ["RELAY_API_KEY"],
)

resp = client.chat.completions.create(
    model="deepseek/deepseek-reasoner",
    messages=[{"role": "user", "content": "Prove that sqrt(2) is irrational."}],
)

msg = resp.choices[0].message
print("reasoning:", msg.reasoning_content)   # chain-of-thought trace, R1-specific field
print("answer:", msg.content)</pre>
      </div>

      <p class="spot-sub">Two DeepSeek models are available, each suited to a different job:</p>
      <table class="model-table">
        <tr><th>Model ID</th><th>What it is</th><th>Good for</th></tr>
        <tr><td><code>deepseek/deepseek-chat</code></td><td>DeepSeek-V3, 671B MoE</td><td>General chat, low-latency, cheap drafting</td></tr>
        <tr><td><code>deepseek/deepseek-reasoner</code></td><td>DeepSeek-R1, 671B MoE</td><td>Multi-step reasoning, math, code — returns a <code>reasoning_content</code> trace</td></tr>
      </table>

      <p class="spot-sub">Notes specific to DeepSeek on Relay:</p>
      <ul class="checklist">
        <li><code>deepseek-reasoner</code> ignores <code>temperature</code>, <code>top_p</code>, and <code>presence_penalty</code> — the reasoning step is deterministic-ish by design.</li>
        <li>Relay passes through DeepSeek's on-disk prompt caching: a repeated prompt prefix bills cache-hit tokens at a steep discount — no extra setup required.</li>
        <li><code>reasoning_content</code> is not billed as output tokens the same way as <code>content</code> — see the pricing tab for the exact split.</li>
      </ul>
    `,
  },
  {
    id: "pricing-breakdown",
    label: "Pricing & cost comparison",
    summary: "Exact per-token pricing and a worked monthly bill comparison against per-seat Claude Code and Cursor pricing — for a CFO reviewing why the LLM bill changed.",
    render: () => `
      <h3>Exact pricing, worked against your bill</h3>
      <p class="spot-sub">Illustrative figures below — swap in your own token volume to reproduce this comparison.</p>

      <table class="model-table">
        <tr><th>Model</th><th>Input / 1M tok</th><th>Output / 1M tok</th></tr>
        <tr><td>Llama 3.3 70B</td><td>$0.12</td><td>$0.30</td></tr>
        <tr><td>Mixtral 8x7B</td><td>$0.08</td><td>$0.20</td></tr>
        <tr><td>Qwen 2.5 72B</td><td>$0.13</td><td>$0.32</td></tr>
        <tr><td>DeepSeek-R1</td><td>$0.55</td><td>$2.19</td></tr>
      </table>

      <h4>Monthly scenario: 10-person engineering team</h4>
      <p class="spot-sub">Assuming 50M input + 10M output tokens/month on Llama 3.3 70B via Relay:</p>
      <div class="cost-chart-wrap" id="cost-chart-wrap"></div>
      <p class="spot-note">* Illustrative figures for a 10-seat team. Claude Code and Cursor figures are list per-seat pricing as of this writing; actual usage-based costs vary. Not an official comparison from Anthropic or Cursor.</p>
    `,
  },
  {
    id: "compliance-dive",
    label: "Procurement & compliance",
    summary: "SOC 2 report access, data processing addendum, and contract terms — for procurement or legal evaluating a vendor.",
    render: () => `
      <h3>Procurement checklist</h3>
      <ul class="checklist">
        <li>SOC 2 Type II report — available under NDA via the dashboard's Compliance tab.</li>
        <li>Standard Data Processing Addendum (DPA) — auto-generated, no legal review cycle needed for standard terms.</li>
        <li>Zero data retention mode — configurable per workspace, disables prompt/response logging entirely.</li>
        <li>No training on customer data, by default, across every routed provider.</li>
        <li>Net-30 invoicing available above a $2,000/mo committed spend tier.</li>
      </ul>
    `,
  },
];
