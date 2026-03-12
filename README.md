# Thingbert Website

This repository powers the public Thingbert site at [thingbert.com](https://thingbert.com).

## Current Structure

- `index.html` - simple landing page describing Thingbert as a home for ideas
- `compare-your-price-to-medicare.html` - Medicare price comparison tool
- `haiku-lab.html` - haiku generator

## Assets

- `assets/css/main.css` - shared site styling
- `assets/js/site.js` - navigation toggle and reveal behavior
- `assets/js/pfs-client.js` - CMS proxy client for Medicare pricing
- `assets/js/price-check.js` - Medicare comparison page behavior
- `assets/js/haiku-words.js` - haiku word dataset
- `assets/js/haiku-lab.js` - haiku generator behavior

## Working Locally

1. Run a static server from the repository root.
2. Open the local URL in a browser.
3. Edit the HTML, CSS, or JS files directly. There is no build step.

## CMS Pricing Proxy

The browser cannot call the CMS Physician Fee Schedule API directly because of CORS restrictions. Define a proxy endpoint before loading the pricing scripts:

```html
<script>window.ThingbertPriceCheckProxy = 'https://your-proxy.workers.dev';</script>
```

Without the proxy the Medicare comparison tool will fall back to an error message. See `proxy/README.md` for deployment details.
