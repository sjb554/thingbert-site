const PFS_API_BASE = 'https://pfs.data.cms.gov/api/1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const withCors = async (responsePromise) => {
  const response = await responsePromise;
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const ok = (body, init = {}) => {
  const headers = new Headers(init.headers || {});
  Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
  return new Response(body, { status: init.status || 200, headers });
};

async function handleCatalog() {
  const target = `${PFS_API_BASE}/metastore/schemas/dataset/items?show-reference-ids`;
  return withCors(fetch(target, {
    headers: { Accept: 'application/json' },
    redirect: 'follow',
  }));
}

async function handlePricing(request, search) {
  const target = `${PFS_API_BASE}/datastore/query?search=${encodeURIComponent(search)}&redirect=false`;
  const init = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: await request.text(),
  };
  return withCors(fetch(target, init));
}

async function handleRequest(request) {
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return ok('', { status: 204 });
  }

  if (request.method === 'GET' && url.pathname === '/catalog') {
    return handleCatalog();
  }

  if (request.method === 'POST' && url.pathname === '/pricing') {
    const search = url.searchParams.get('search') || 'pricing';
    return handlePricing(request, search);
  }

  return ok('Not found', { status: 404 });
}

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request));
});
