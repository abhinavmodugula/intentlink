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

[Open on Amazon, shaped for you](https://www.amazon.com/dp/B0F8MHPVPH#ll-intent=Quiet%20standing%20desk%2C%20stable%20at%20full%20height%2C%2048%20inches%20wide)

```
https://www.amazon.com/dp/B0F8MHPVPH#ll-intent=Quiet%20standing%20desk%2C%20stable%20at%20full%20height%2C%2048%20inches%20wide
```

## Uniqlo: mens shirts (search)

> Comfortable mens shirts for everyday wear, soft breathable fabric, relaxed fit

Only `q=mens%20shirts` is known to return results reliably — other query terms haven't been
verified against Uniqlo's search backend, so reuse this exact `q` value when testing.

[Open on Uniqlo, shaped for you](https://www.uniqlo.com/us/en/search?q=mens%20shirts&queryRelaxationFlag=true#ll-intent=Comfortable%20mens%20shirts%20for%20everyday%20wear%2C%20soft%20breathable%20fabric%2C%20relaxed%20fit)

```
https://www.uniqlo.com/us/en/search?q=mens%20shirts&queryRelaxationFlag=true#ll-intent=Comfortable%20mens%20shirts%20for%20everyday%20wear%2C%20soft%20breathable%20fabric%2C%20relaxed%20fit
```

## Craigslist: Oakland apartment posting (product page)

> Looking for an apartment with quartz countertops in the kitchen, an in-unit washer and dryer, and a walk-in closet

A single posting instead of a search page: highlights the attrgroup tags and "Unit
Amenities"/"Community Amenities" bullets that are evidence this listing matches the intent,
right on the real page. Underlined (not outlined) on this site specifically — see
`adapters/craigslist.css`.

[Open on Craigslist, shaped for you](https://www.craigslist.org/view/d/oakland-or-higher-ceilings-throughout/jTDLXjwrLHDwFDwcX956yV#ll-intent=Looking%20for%20an%20apartment%20with%20quartz%20countertops%20in%20the%20kitchen%2C%20an%20in-unit%20washer%20and%20dryer%2C%20and%20a%20walk-in%20closet)

```
https://www.craigslist.org/view/d/oakland-or-higher-ceilings-throughout/jTDLXjwrLHDwFDwcX956yV#ll-intent=Looking%20for%20an%20apartment%20with%20quartz%20countertops%20in%20the%20kitchen%2C%20an%20in-unit%20washer%20and%20dryer%2C%20and%20a%20walk-in%20closet
```

## Note on pass-1 filtering

The regex in `lib/filters.js` only parses an upper price bound (`under $X`), a minimum star
rating (`X star`/`X★`), and `prime` as hard, deterministic pass-1 filters. Dimensions,
shelf/preset counts, and comfort/quality language ("breathable," "durable wheels," "4+ hours")
are not parsed as numeric filters — they only influence ranking via the active rank engine's
semantic judgment (DeepSeek or Jev) plus plain keyword matching, not the instant pass-1 dim/hide.
