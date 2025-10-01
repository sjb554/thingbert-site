# Thingbert Website

Thingbert is a small studio for actuarial-flavored data storytelling. This repository powers the public site hosted on GitHub Pages at [thingbert.com](https://thingbert.com).

## Contents

- **Landing & About** - overview of services, approach, and recent briefings.
- **Projects & Insights** - curated write-ups that highlight healthcare, finance, and workforce analyses.
- **Contact** - request channel for collaborations and custom research.

## Project Structure

```
assets/
  css/        Global site styles
  js/         Client-side behaviour (navigation, reveal effects)
about.html    About the studio
contact.html  Contact form and instructions
index.html    Landing page
market.html   Insights library
projects.html Project catalogue
```

## Working Locally

1. Clone the repository and install a lightweight static server (for example `npm install -g serve` or use Python's `http.server`).
2. Run the server from the repository root and open `http://localhost:5000` (or the port you choose).
3. Edit HTML, CSS, or JS files; the site has no build step so changes are reflected immediately upon refresh.

## Contributing

- Keep navigation, metadata, and styling consistent across pages.
- Add new assets under `assets/` and reference them with relative paths.
- Follow semantic HTML conventions and limit inline styles.
- Use clear, descriptive commit messages (see examples below).
- Open a pull request with a short summary of the change and screenshots when modifying page layout.

## Deployment

GitHub Pages deploys automatically from the `main` branch using the custom domain configured in [`CNAME`](CNAME). Pushes to `main` will be visible on the live site within minutes.

## Suggested Commit Message Style

- `Add projects page with latest briefings`
- `Refine navigation copy and metadata descriptions`
- `Polish README with project overview and contribution notes`