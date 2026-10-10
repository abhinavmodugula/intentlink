# Demo / test IntentLinks

Hand-built IntentLinks for manual testing without going through a chat — paste any of these
directly into Chrome's address bar on a signed-in Amazon profile with the extension loaded.

Each follows the format `https://www.amazon.com/s?k=<search words>#ll-intent=<full prompt,
URL-encoded>`. Regenerate/extend this list with:

```bash
node -e '
const queries = [ /* { words, intent } */ ];
for (const q of queries) {
  const k = q.words.trim().split(/\s+/).join("+");
  console.log(`https://www.amazon.com/s?k=${k}#ll-intent=${encodeURIComponent(q.intent)}`);
}'
```

## Standing desk

> Standing desk 48 inches wide, under $250, stable at maximum height, with memory presets

[Open on Amazon, shaped for you](https://www.amazon.com/s?k=standing+desk+48+inch#ll-intent=Standing%20desk%2048%20inches%20wide%2C%20under%20%24250%2C%20stable%20at%20maximum%20height%2C%20with%20memory%20presets)

```
https://www.amazon.com/s?k=standing+desk+48+inch#ll-intent=Standing%20desk%2048%20inches%20wide%2C%20under%20%24250%2C%20stable%20at%20maximum%20height%2C%20with%20memory%20presets
```

## Product page: standing desk (recommended-product mode)

> Quiet standing desk, stable at full height, 48 inches wide

A single-product page instead of a search page: the extension highlights the feature
bullets / spec rows / review snippets that are the evidence this product matches the
intent, dims the rest, and pins a "Recommended because: …" card at the top. Swap in any
real `/dp/<ASIN>` URL you have open.

```
https://www.amazon.com/dp/B0F8MHPVPH#ll-intent=Quiet%20standing%20desk%2C%20stable%20at%20full%20height%2C%2048%20inches%20wide
```

## Walmart: shoes (search)

> Comfortable running shoes for flat feet, under $60, good arch support

```
https://www.walmart.com/search?q=shoes&action=SignIn&rm=true#ll-intent=Comfortable%20running%20shoes%20for%20flat%20feet%2C%20under%20%2460%2C%20good%20arch%20support
```

## Walmart: Avia sneakers (product page)

> Lightweight athletic sneakers for all-day standing at work, breathable, under $40

```
https://www.walmart.com/ip/Avia-Men-s-5000-Athletic-Performance-Sneakers/15106815936?classType=VARIANT&athbdg=L1600&from=/search#ll-intent=Lightweight%20athletic%20sneakers%20for%20all-day%20standing%20at%20work%2C%20breathable%2C%20under%20%2440
```

## Uniqlo: mens shirts (search)

> Comfortable mens shirts for everyday wear, soft breathable fabric, relaxed fit

Only `q=mens%20shirts` is known to return results reliably — other query terms haven't been
verified against Uniqlo's search backend, so reuse this exact `q` value when testing.

[Open on Uniqlo, shaped for you](https://www.uniqlo.com/us/en/search?q=mens%20shirts&queryRelaxationFlag=true#ll-intent=Comfortable%20mens%20shirts%20for%20everyday%20wear%2C%20soft%20breathable%20fabric%2C%20relaxed%20fit)

```
https://www.uniqlo.com/us/en/search?q=mens%20shirts&queryRelaxationFlag=true#ll-intent=Comfortable%20mens%20shirts%20for%20everyday%20wear%2C%20soft%20breathable%20fabric%2C%20relaxed%20fit
```

## Note on pass-1 filtering

The regex in `lib/filters.js` only parses an upper price bound (`under $X`), a minimum star
rating (`X star`/`X★`), and `prime` as hard, deterministic pass-1 filters. Dimensions,
shelf/preset counts, and comfort/quality language ("breathable," "durable wheels," "4+ hours")
are not parsed as numeric filters — they only influence ranking via the active rank engine's
semantic judgment (DeepSeek or Jev) plus plain keyword matching, not the instant pass-1 dim/hide.
