# CMS PFS Proxy

The CMS Physician Fee Schedule API blocks cross-origin requests, so the
front-end needs a tiny proxy. This Cloudflare Worker reproduces the same
requests the UI makes and adds permissive CORS headers so the browser can
read the responses.

## Deploy on Cloudflare Workers

1. [Install Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/).
2. Run `wrangler init thingbert-pfs-proxy --from-dash --type=javascript` (or
   `wrangler init` and select "existing" when prompted).
3. Replace the generated Worker script with `proxy/cloudflare-worker.js`.
4. Deploy: `wrangler deploy`.
5. Note the Worker URL, e.g. `https://thingbert-pfs-proxy.workers.dev`.

## Connect the front-end

Before `assets/js/pfs-client.js` loads, set the global proxy base URL:

```html
<script>
  window.ThingbertPriceCheckProxy = 'https://thingbert-pfs-proxy.workers.dev';
</script>
```

Place the snippet in `compare-your-price-to-medicare.html` (or a layout include)
*before* the `<script src="assets/js/pfs-client.js" ...>` tag. The helper will
fallback to direct CMS calls if the global isn’t defined.

## Local testing

`wrangler dev` spins up the Worker locally. In development you can set
`window.ThingbertPriceCheckProxy = 'http://127.0.0.1:8787'`.

## Alternative hosts

Any platform that can forward requests (Netlify Functions, Vercel, AWS Lambda,
Render) will work. The proxy just needs to:

1. Accept POST bodies and GET requests.
2. Forward them to `https://pfs.data.cms.gov/api/1/...`.
3. Return the response with `Access-Control-Allow-Origin: *` (at minimum).

