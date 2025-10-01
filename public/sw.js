// Custom Service Worker for Baseline Analyzer
// This extends the default next-pwa service worker with custom offline functionality

const CACHE_NAME = 'baseline-analyzer-v1';
const OFFLINE_CACHE = 'baseline-analyzer-offline-v1';
const ANALYSIS_QUEUE_CACHE = 'baseline-analyzer-queue-v1';

// URLs to cache for offline functionality
const STATIC_CACHE_URLS = [
  '/',
  '/dashboard',
  '/analysis',
  '/credits',
  '/repository-analysis',
  '/offline',
  '/manifest.json'
];

// API endpoints that should be cached
const API_CACHE_PATTERNS = [
  /^\/api\/auth\//,
  /^\/api\/credits\/$/,
  /^\/api\/organizations\//,
  /^\/api\/baseline\/search/
];

// Install event - cache static resources
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker');
  
  event.waitUntil(
    Promise.all([
      // Cache static resources
      caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(STATIC_CACHE_URLS);
      }),
      // Initialize offline queue cache
      caches.open(ANALYSIS_QUEUE_CACHE).then((cache) => {
        return cache.put('queue', new Response(JSON.stringify([])));
      })
    ])
  );
  
  // Force activation of new service worker
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && 
                cacheName !== OFFLINE_CACHE && 
                cacheName !== ANALYSIS_QUEUE_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all clients
      self.clients.claim()
    ])
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and chrome-extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }

  // Handle different types of requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
  } else if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(handleStaticAssets(request));
  } else {
    event.respondWith(handlePageRequest(request));
  }
});

// Handle API requests with network-first strategy
async function handleApiRequest(request) {
  const url = new URL(request.url);
  
  // Special handling for analysis requests
  if (url.pathname.startsWith('/api/analysis')) {
    return handleAnalysisRequest(request);
  }
  
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    // Cache successful responses for specific endpoints
    if (networkResponse.ok && shouldCacheApiResponse(url.pathname)) {
      const cache = await caches.open(OFFLINE_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed for API request:', request.url);
    
    // Try to serve from cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline response for critical endpoints
    return createOfflineApiResponse(url.pathname);
  }
}

// Handle static assets with cache-first strategy
async function handleStaticAssets(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Failed to fetch static asset:', request.url);
    return new Response('Asset not available offline', { status: 404 });
  }
}

// Handle page requests with network-first, fallback to cache
async function handlePageRequest(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful page responses
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed for page request:', request.url);
    
    // Try to serve from cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fallback to offline page
    const offlinePage = await caches.match('/offline');
    return offlinePage || new Response('Page not available offline', { 
      status: 404,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

// Handle analysis requests - queue when offline
async function handleAnalysisRequest(request) {
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    console.log('[SW] Analysis request failed, queuing for later:', request.url);
    
    if (request.method === 'POST') {
      // Queue the analysis request
      await queueAnalysisRequest(request);
      
      // Return a response indicating the request was queued
      return new Response(JSON.stringify({
        success: true,
        queued: true,
        message: 'Analysis request queued for when connection is restored'
      }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      error: 'Analysis service unavailable offline'
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Queue analysis request for later processing
async function queueAnalysisRequest(request) {
  try {
    const requestData = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body: await request.text(),
      timestamp: Date.now()
    };
    
    const cache = await caches.open(ANALYSIS_QUEUE_CACHE);
    const queueResponse = await cache.match('queue');
    const queue = queueResponse ? await queueResponse.json() : [];
    
    queue.push(requestData);
    
    await cache.put('queue', new Response(JSON.stringify(queue)));
    
    // Notify the main thread about the queued request
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'ANALYSIS_QUEUED',
          data: { url: request.url, timestamp: requestData.timestamp }
        });
      });
    });
  } catch (error) {
    console.error('[SW] Failed to queue analysis request:', error);
  }
}

// Process queued analysis requests when online
async function processQueuedRequests() {
  try {
    const cache = await caches.open(ANALYSIS_QUEUE_CACHE);
    const queueResponse = await cache.match('queue');
    const queue = queueResponse ? await queueResponse.json() : [];
    
    if (queue.length === 0) return;
    
    console.log(`[SW] Processing ${queue.length} queued requests`);
    
    const processedRequests = [];
    
    for (const requestData of queue) {
      try {
        const response = await fetch(requestData.url, {
          method: requestData.method,
          headers: requestData.headers,
          body: requestData.body
        });
        
        if (response.ok) {
          processedRequests.push(requestData);
          
          // Notify the main thread about successful processing
          self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({
                type: 'ANALYSIS_PROCESSED',
                data: { url: requestData.url, timestamp: requestData.timestamp }
              });
            });
          });
        }
      } catch (error) {
        console.log('[SW] Failed to process queued request:', requestData.url);
      }
    }
    
    // Remove processed requests from queue
    const remainingQueue = queue.filter(req => 
      !processedRequests.some(processed => 
        processed.timestamp === req.timestamp
      )
    );
    
    await cache.put('queue', new Response(JSON.stringify(remainingQueue)));
    
  } catch (error) {
    console.error('[SW] Failed to process queued requests:', error);
  }
}

// Check if API response should be cached
function shouldCacheApiResponse(pathname) {
  return API_CACHE_PATTERNS.some(pattern => pattern.test(pathname));
}

// Create offline API response
function createOfflineApiResponse(pathname) {
  const offlineData = {
    error: 'Service unavailable offline',
    offline: true,
    pathname
  };
  
  // Provide specific offline responses for critical endpoints
  if (pathname === '/api/credits') {
    offlineData.credits = 0;
    offlineData.message = 'Credit balance unavailable offline';
  }
  
  return new Response(JSON.stringify(offlineData), {
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Listen for online/offline events
self.addEventListener('online', () => {
  console.log('[SW] Connection restored, processing queued requests');
  processQueuedRequests();
});

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
    case 'PROCESS_QUEUE':
      processQueuedRequests();
      break;
    case 'CLEAR_CACHE':
      clearCaches(data?.cacheNames);
      break;
  }
});

// Clear specific caches
async function clearCaches(cacheNames = []) {
  const allCaches = await caches.keys();
  const cachesToDelete = cacheNames.length > 0 ? cacheNames : allCaches;
  
  await Promise.all(
    cachesToDelete.map(cacheName => caches.delete(cacheName))
  );
  
  console.log('[SW] Cleared caches:', cachesToDelete);
}