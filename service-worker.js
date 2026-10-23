
"use strict";

// Increment this whenever the cached app files need to be refreshed.
const CACHE_NAME = "scale-practice-v20";

// Resolve the app's base path from the service worker's location.
const APP_BASE = new URL("./", self.location.href);
const OFFLINE_URL = APP_BASE.href;

// Files required to open the app offline.
// Keep these paths aligned with your actual project structure.
const APP_FILES = [
    "./",
    "./scales-builder/index.html",
    "./index.html",
    "./404.html",
    "./style.css",
    "./script.js",
    "./scales-data.json",
    "./manifest.json"
].map(path => new URL(path, APP_BASE).href);


// Install: cache the core app files for offline use.
self.addEventListener("install", event => {
    event.waitUntil(
        (async () => {
            const cache = await caches.open(CACHE_NAME);

            await cache.addAll(APP_FILES);
            await self.skipWaiting();
        })()
    );
});


// Activate: remove older versions of this app's cache.
self.addEventListener("activate", event => {
    event.waitUntil(
        (async () => {
            const cacheNames = await caches.keys();

            await Promise.all(
                cacheNames
                    .filter(name =>
                        name.startsWith("scale-practice-") &&
                        name !== CACHE_NAME
                    )
                    .map(name => caches.delete(name))
            );

            await self.clients.claim();
        })()
    );
});


// Fetch: use cached files offline and update them when online.
self.addEventListener("fetch", event => {
    const request = event.request;
    const url = new URL(request.url);

    // Only handle GET requests for this website's own origin.
    if (
        request.method !== "GET" ||
        url.origin !== self.location.origin
    ) {
        return;
    }

    // Keep requests outside this website's base path untouched.
    if (!url.href.startsWith(APP_BASE.href)) {
        return;
    }

    // For page navigation, prefer the network and fall back offline.
    if (request.mode === "navigate") {
        event.respondWith(
            (async () => {
                try {
                    const response = await fetch(request);

                    if (response.ok) {
                        const cache = await caches.open(CACHE_NAME);
                        await cache.put(request, response.clone());
                    }

                    return response;
                } catch {
                    return (
                        await caches.match(request) ||
                        await caches.match(OFFLINE_URL) ||
                        await caches.match(
                            new URL("./index.html", APP_BASE).href
                        ) ||
                        Response.error()
                    );
                }
            })()
        );

        return;
    }

    // For assets, use the cached version immediately when available.
    event.respondWith(
        (async () => {
            const cachedResponse = await caches.match(request);

            if (cachedResponse) {
                // Refresh the cache in the background when online.
                event.waitUntil(
                    fetch(request)
                        .then(async response => {
                            if (response.ok && response.type === "basic") {
                                const cache = await caches.open(CACHE_NAME);
                                await cache.put(request, response);
                            }
                        })
                        .catch(() => {})
                );

                return cachedResponse;
            }

            // Fetch and cache assets not yet stored.
            const response = await fetch(request);

            if (response.ok && response.type === "basic") {
                const cache = await caches.open(CACHE_NAME);
                await cache.put(request, response.clone());
            }

            return response;
        })()
    );
});
