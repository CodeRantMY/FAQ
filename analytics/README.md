# Analytics and Frequently Visited FAQs

The website is static, so it cannot calculate site-wide popularity without an analytics provider or a committed data export.

Supported setup:

1. Configure `assets/js/config.js`.
   - Plausible: set `analytics.plausibleDomain`.
   - GoatCounter: set `analytics.goatCounterCode`.
2. Export FAQ page/event counts from the analytics provider.
3. Update `analytics/popular.json` with the most visited FAQ IDs.
4. Run `python3 scripts/build_site_data.py` and commit the generated `assets/js/popular-data.js`.

Example:

```json
{
  "source": "plausible",
  "updated": "2026-05-11",
  "items": [
    { "id": "birth-certificates-how-to-get-a-birth-certificate-from-jpn", "views": 120 },
    { "id": "jobs-taxes-what-if-i-didnt-get-my-tax-refund", "views": 87 }
  ]
}
```

When `analytics/popular.json` is empty, the site falls back to locally viewed FAQs in the current browser.
