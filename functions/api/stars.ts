// Cloudflare Pages Function — proxies GitHub star count with edge caching.
// Cloudflare CDN respects the Cache-Control header, so this is hit at most
// once per 6 hours per edge PoP. All visitors share the same cached response.

export const onRequestGet: PagesFunction = async (context) => {
    const cache = caches.default;
    const cacheKey = new Request(new URL('/api/stars', context.request.url), {
        method: 'GET',
    });

    // Check edge cache first
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    // Cache miss — fetch from GitHub
    try {
        const res = await fetch('https://api.github.com/repos/sahil-shubham/bhatti', {
            headers: { 'User-Agent': 'bhatti.sh' },
        });
        const data = await res.json() as { stargazers_count?: number };
        const stars = data.stargazers_count ?? null;

        const response = new Response(JSON.stringify({ stars }), {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, s-maxage=21600, max-age=21600',
                'Access-Control-Allow-Origin': '*',
            },
        });

        // Store in edge cache
        context.waitUntil(cache.put(cacheKey, response.clone()));
        return response;
    } catch {
        return new Response(JSON.stringify({ stars: null }), {
            status: 502,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
