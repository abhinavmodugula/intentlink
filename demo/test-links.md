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

## 1. Office chair

> Best ergonomic office chair for long coding sessions, under $300, breathable mesh, adjustable lumbar support

[Open on Amazon, shaped for you](https://www.amazon.com/s?k=ergonomic+office+chair+mesh+lumbar+support#ll-intent=Best%20ergonomic%20office%20chair%20for%20long%20coding%20sessions%2C%20under%20%24300%2C%20breathable%20mesh%2C%20adjustable%20lumbar%20support)

```
https://www.amazon.com/s?k=ergonomic+office+chair+mesh+lumbar+support#ll-intent=Best%20ergonomic%20office%20chair%20for%20long%20coding%20sessions%2C%20under%20%24300%2C%20breathable%20mesh%2C%20adjustable%20lumbar%20support
```

## 2. Bookshelf

> White bookshelf 18–22 inches wide, less than 10 inches deep, at least 5 shelves, under $120, with good reviews

[Open on Amazon, shaped for you](https://www.amazon.com/s?k=white+bookshelf+5+shelves#ll-intent=White%20bookshelf%2018%E2%80%9322%20inches%20wide%2C%20less%20than%2010%20inches%20deep%2C%20at%20least%205%20shelves%2C%20under%20%24120%2C%20with%20good%20reviews)

```
https://www.amazon.com/s?k=white+bookshelf+5+shelves#ll-intent=White%20bookshelf%2018%E2%80%9322%20inches%20wide%2C%20less%20than%2010%20inches%20deep%2C%20at%20least%205%20shelves%2C%20under%20%24120%2C%20with%20good%20reviews
```

## 3. Headphones

> Noise-cancelling headphones for commuting and flights, under $150, comfortable for 4+ hours

[Open on Amazon, shaped for you](https://www.amazon.com/s?k=noise+cancelling+headphones#ll-intent=Noise-cancelling%20headphones%20for%20commuting%20and%20flights%2C%20under%20%24150%2C%20comfortable%20for%204%2B%20hours)

```
https://www.amazon.com/s?k=noise+cancelling+headphones#ll-intent=Noise-cancelling%20headphones%20for%20commuting%20and%20flights%2C%20under%20%24150%2C%20comfortable%20for%204%2B%20hours
```

## 4. Standing desk

> Standing desk 48 inches wide, under $250, stable at maximum height, with memory presets

[Open on Amazon, shaped for you](https://www.amazon.com/s?k=standing+desk+48+inch#ll-intent=Standing%20desk%2048%20inches%20wide%2C%20under%20%24250%2C%20stable%20at%20maximum%20height%2C%20with%20memory%20presets)

```
https://www.amazon.com/s?k=standing+desk+48+inch#ll-intent=Standing%20desk%2048%20inches%20wide%2C%20under%20%24250%2C%20stable%20at%20maximum%20height%2C%20with%20memory%20presets
```

## 5. Carry-on suitcase

> Carry-on suitcase under $150, lightweight, expandable, durable wheels, no common handle or zipper issues

[Open on Amazon, shaped for you](https://www.amazon.com/s?k=carry+on+suitcase+expandable#ll-intent=Carry-on%20suitcase%20under%20%24150%2C%20lightweight%2C%20expandable%2C%20durable%20wheels%2C%20no%20common%20handle%20or%20zipper%20issues)

```
https://www.amazon.com/s?k=carry+on+suitcase+expandable#ll-intent=Carry-on%20suitcase%20under%20%24150%2C%20lightweight%2C%20expandable%2C%20durable%20wheels%2C%20no%20common%20handle%20or%20zipper%20issues
```

## Note on pass-1 filtering

The regex in `lib/filters.js` only parses an upper price bound (`under $X`), a minimum star
rating (`X star`/`X★`), and `prime` as hard, deterministic pass-1 filters. Dimensions,
shelf/preset counts, and comfort/quality language ("breathable," "durable wheels," "4+ hours")
are not parsed as numeric filters — they only influence ranking via the active rank engine's
semantic judgment (DeepSeek or Jev) plus plain keyword matching, not the instant pass-1 dim/hide.
