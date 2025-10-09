# Thingbert Website

Thingbert is a small studio for actuarial-flavored data storytelling. This repository powers the public site hosted on GitHub Pages at [thingbert.com](https://thingbert.com).

## Contents

- **Landing & About** – overview of services, approach, and recent briefings.
- **Projects & Insights** – curated write-ups that highlight healthcare, finance, and workforce analyses.
- **Labs** – sandbox write-ups that pair reproducible code with interactive demos, such as the Cleveland heart disease risk prototype.
- **Contact** – request channel for collaborations and custom research.

## Project Structure

```
assets/
  css/        Global site styles
  data/       Downloadable data assets surfaced on the site
  docs/       Plain-text or PDF supporting documents
  img/        Images and illustrations used across pages
  js/         Client-side behaviour (navigation, reveal effects, labs)
  models/     Serialized artefacts used by interactive labs
about.html    About the studio
contact.html  Contact form and instructions
index.html    Landing page
labs.html     Thingbert Labs showcase
market.html   Insights library
projects.html Project catalogue
```

## Working Locally

1. Clone the repository and install a lightweight static server (for example `npm install -g serve` or use Python’s `http.server`).
2. Run the server from the repository root and open `http://localhost:5000` (or the port you choose).
3. Edit HTML, CSS, or JS files; the site has no build step so changes are reflected immediately upon refresh.

## Contributing

- Keep navigation, metadata, and styling consistent across pages.
- Add new assets to the appropriate folder under `assets/` and reference them with relative paths.
- Follow semantic HTML conventions and limit inline styles.
- Use clear, descriptive commit messages (see examples below).
- Open a pull request with a short summary of the change and screenshots when modifying page layout.

## Deployment

GitHub Pages deploys automatically from the `main` branch using the custom domain configured in [`CNAME`](CNAME). Pushes to `main` will be visible on the live site within minutes.

## Suggested Commit Message Style

- `Add labs page introducing heart disease risk prototype`
- `Refine navigation copy and metadata descriptions`
- `Organize assets into css, js, data, docs, img, models folders`
- `Polish README with project overview and contribution notes`

## CMS Pricing Proxy

The browser cannot call the CMS Physician Fee Schedule API directly because of CORS restrictions. Deploy the Cloudflare Worker in `proxy/cloudflare-worker.js` (or any equivalent proxy) and define the endpoint before the pricing scripts load:

```html
<script>window.ThingbertPriceCheckProxy = 'https://your-proxy.workers.dev';</script>
```

Without the proxy the Medicare comparison table will fall back to an error message. See `proxy/README.md` for deployment steps.
