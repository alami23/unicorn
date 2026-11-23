const CACHE_VERSION = 'v1';
const STATIC_CACHE = `furnitrack-static-${CACHE_VERSION}`;
const PAGES_CACHE = `furnitrack-pages-${CACHE_VERSION}`;
const DATA_CACHE = `furnitrack-data-${CACHE_VERSION}`;
const MAX_DATA_AGE_MS = 5 * 60 * 1000; // 5 minutes
const MAX_DATA_ENTRIES = 180;

const TABLE_INVALIDATION_GRAPH = {
  furniture_invoices: ['furniture_invoices', 'furniture_invoice_items', 'furniture_inventory', 'customer', 'transactions'],
  furniture_invoice_items: ['furniture_invoices', 'furniture_invoice_items', 'furniture_inventory'],
  wood_invoices: ['wood_invoices', 'wood_invoice_items', 'wood_inventory', 'customer', 'transactions'],
  wood_invoice_items: ['wood_invoices', 'wood_invoice_items', 'wood_inventory'],
  transactions: ['transactions', 'customer', 'furniture_invoices', 'wood_invoices'],
  customer: ['customer', 'transactions', 'furniture_invoices', 'wood_invoices'],
  furniture_inventory: ['furniture_inventory', 'furniture_category'],
  furniture_category: ['furniture_category', 'furniture_inventory'],
  wood_inventory: ['wood_inventory', 'wood_category', 'wood_category_car', 'wood_category_tag'],
  wood_category: ['wood_category', 'wood_inventory'],
  wood_category_car: ['wood_category_car', 'wood_inventory'],
  wood_category_tag: ['wood_category_tag', 'wood_inventory'],
  bills: ['bills', 'vendors', 'categories'],
  vendors: ['vendors', 'bills'],
  categories: ['categories', 'bills'],
  staff: ['staff'],
  app_settings: ['app_settings'],
  sms_history: ['sms_history'],
};

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const validCaches = new Set([STATIC_CACHE, PAGES_CACHE, DATA_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('furnitrack-') && !validCaches.has(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function extractSupabaseTable(urlObj) {
  const match = urlObj.pathname.match(/\/rest\/v1\/([a-zA-Z0-9_-]+)/);
  if (!match) return null;
  const table = match[1];
  if (table === 'rpc') return null;
  return table;
}

function expandTables(table) {
  return TABLE_INVALIDATION_GRAPH[table] || [table];
}

function buildTenantDataCacheKey(orgId, table, request) {
  const method = (request.method || 'GET').toUpperCase();
  const prefer = request.headers.get('prefer') || '';
  const range = request.headers.get('range') || '';
  const accept = request.headers.get('accept') || '';
  return `https://sw-tenant-cache.local/${encodeURIComponent(orgId)}/${encodeURIComponent(table)}/${encodeURIComponent(method)}?u=${encodeURIComponent(request.url)}&p=${encodeURIComponent(prefer)}&r=${encodeURIComponent(range)}&a=${encodeURIComponent(accept)}`;
}

async function invalidateTenantTables(orgId, tables) {
  if (!tables || tables.length === 0) return;
  const cache = await caches.open(DATA_CACHE);
  const keys = await cache.keys();
  const tableSet = new Set(tables);
  const orgPrefix = orgId ? `https://sw-tenant-cache.local/${encodeURIComponent(orgId)}/` : 'https://sw-tenant-cache.local/';

  await Promise.all(
    keys.map((req) => {
      const keyUrl = req.url;
      if (!keyUrl.startsWith(orgPrefix)) return Promise.resolve();
      const parts = keyUrl.replace('https://sw-tenant-cache.local/', '').split('/');
      const keyTable = decodeURIComponent(parts[1] || '');
      if (tableSet.has(keyTable)) {
        return cache.delete(req);
      }
      return Promise.resolve();
    })
  );
}

async function clearTenantCache(orgId) {
  const cache = await caches.open(DATA_CACHE);
  if (!orgId) {
    await caches.delete(DATA_CACHE);
    return;
  }
  const keys = await cache.keys();
  const prefix = `https://sw-tenant-cache.local/${encodeURIComponent(orgId)}/`;
  await Promise.all(
    keys
      .filter((req) => req.url.startsWith(prefix))
      .map((req) => cache.delete(req))
  );
}

async function trimDataCache(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_DATA_ENTRIES) return;
  const excess = keys.length - MAX_DATA_ENTRIES;
  await Promise.all(keys.slice(0, excess).map((req) => cache.delete(req)));
}

async function putTimestampedResponse(cache, cacheKey, response) {
  if (!response || (response.status !== 200 && response.status !== 206)) return;
  const headers = new Headers(response.headers);
  headers.set('x-sw-cached-at', String(Date.now()));
  const body = await response.clone().arrayBuffer();
  // Skip caching oversized responses (> 2MB) to keep SW memory lean
  if (body.byteLength > 2 * 1024 * 1024) return;
  const wrapped = new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
  await cache.put(cacheKey, wrapped);
  await trimDataCache(cache);
}

self.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (msg.type === 'INVALIDATE_TABLES') {
    event.waitUntil(invalidateTenantTables(msg.orgId || '', msg.tables || []));
    return;
  }

  if (msg.type === 'CLEAR_TENANT_CACHE') {
    event.waitUntil(clearTenantCache(msg.orgId || ''));
    return;
  }

  if (msg.type === 'CLEAR_ALL_CACHES') {
    event.waitUntil(
      Promise.all([caches.delete(DATA_CACHE), caches.delete(PAGES_CACHE)])
    );
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  const isSameOrigin = url.origin === self.location.origin;

  // Never intercept dev HMR, API routes, or Supabase auth/storage endpoints
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/webpack-hmr') ||
    url.pathname.startsWith('/__nextjs') ||
    url.pathname.includes('/auth/v1/') ||
    url.pathname.includes('/storage/v1/')
  ) {
    return;
  }

  // 1. Supabase REST endpoints (/rest/v1/<table>)
  const supabaseTable = extractSupabaseTable(url);
  if (supabaseTable) {
    const method = (request.method || 'GET').toUpperCase();
    const orgId = request.headers.get('x-org-id') || '';

    // Mutations: always go straight to network and invalidate related tables in SW cache
    if (method !== 'GET' && method !== 'HEAD') {
      const affected = expandTables(supabaseTable);
      event.respondWith(
        fetch(request).finally(() => {
          event.waitUntil(invalidateTenantTables(orgId, affected));
        })
      );
      return;
    }

    // Strict tenant isolation: never cache requests without x-org-id or explicit cache bypass
    if (!orgId || request.headers.get('x-bypass-cache') === '1') {
      return;
    }

    const cacheKey = buildTenantDataCacheKey(orgId, supabaseTable, request);
    event.respondWith(
      (async () => {
        const cache = await caches.open(DATA_CACHE);
        const cached = await cache.match(cacheKey);

        const networkFetch = fetch(request.clone())
          .then(async (networkRes) => {
            if (networkRes && (networkRes.status === 200 || networkRes.status === 206)) {
              await putTimestampedResponse(cache, cacheKey, networkRes.clone());
            }
            return networkRes;
          })
          .catch((err) => {
            if (cached) return cached;
            throw err;
          });

        if (cached) {
          const cachedAt = Number(cached.headers.get('x-sw-cached-at') || 0);
          const age = Date.now() - cachedAt;
          if (age <= MAX_DATA_AGE_MS) {
            event.waitUntil(networkFetch.catch(() => {}));
            return cached;
          }
        }

        return networkFetch;
      })()
    );
    return;
  }

  // Only handle GET for same-origin static assets & Next.js routes
  if (!isSameOrigin || request.method !== 'GET') return;

  // 2. Immutable static assets (Cache-First)
  if (
    url.pathname.startsWith('/_next/static/') ||
    /\.(?:woff2?|ttf|eot|png|jpg|jpeg|webp|svg|ico)$/i.test(url.pathname)
  ) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response && response.status === 200) {
          cache.put(request, response.clone()).catch(() => {});
        }
        return response;
      })
    );
    return;
  }

  // 3. Same-origin Next.js page navigations & RSC payloads (Network-First with cache fallback)
  const isNavigation = request.mode === 'navigate';
  const isRscPayload = request.headers.get('rsc') === '1' || url.searchParams.has('_rsc');
  if (isNavigation || isRscPayload) {
    event.respondWith(
      caches.open(PAGES_CACHE).then(async (cache) => {
        try {
          const networkRes = await fetch(request);
          if (networkRes && networkRes.status === 200) {
            cache.put(request, networkRes.clone()).catch(() => {});
          }
          return networkRes;
        } catch {
          const cached = await cache.match(request);
          if (cached) return cached;
          throw new Error('Network unavailable');
        }
      })
    );
  }
});
