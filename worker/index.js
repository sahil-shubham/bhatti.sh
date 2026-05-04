// Cloudflare Worker for bhatti.sh.
//
// Two responsibilities:
//   1. Same-origin proxy for the self-hosted Umami tracker, so ad-blockers
//      see /cf/* requests against bhatti.sh instead of a third-party
//      analytics hostname. Without this, blocklists strip ~30-50% of
//      analytics traffic on a typical dev/tech audience.
//   2. Fall through to the static-asset binding (env.ASSETS) for everything
//      else. The asset directory is configured in wrangler.toml.
//
// Path scheme:
//   GET  bhatti.sh/cf/script.js  ->  GET  mymami.sahil-shubham.in/script.js
//   POST bhatti.sh/cf/api/send   ->  POST mymami.sahil-shubham.in/api/send

const UPSTREAM = 'https://mymami.sahil-shubham.in';
const PREFIX = '/cf/';
// The only origin we accept analytics POSTs from. Same-origin browser
// fetches from bhatti.sh always carry this header; curl/wget/scripts
// from elsewhere don't, and naive abuse stops here. A determined
// attacker can spoof Origin from a non-browser client — this is a
// "go away" sign for the lazy, not a real security boundary.
const ALLOWED_ORIGIN = 'https://bhatti.sh';
// Tracker scripts we'll proxy. script.js is pageviews-only; recorder.js
// is the v3.1+ all-in-one bundle that adds session replay on top.
// Anything not on this list 404s through the asset binding.
const PROXIED_SCRIPTS = new Set(['script.js', 'recorder.js']);

export default {
    /**
     * @param {Request} request
     * @param {{ ASSETS: Fetcher }} env
     */
    async fetch(request, env) {
        const url = new URL(request.url);

        // 1. Tracker scripts — cache at the edge for an hour. Umami releases
        //    are infrequent (weeks), so this is plenty fresh while keeping
        //    origin load near-zero. Same handling for script.js and
        //    recorder.js; we just forward whichever one was asked for.
        if (url.pathname.startsWith(PREFIX)) {
            const filename = url.pathname.slice(PREFIX.length);
            if (PROXIED_SCRIPTS.has(filename)) {
                const upstream = new Request(`${UPSTREAM}/${filename}`, {
                    method: 'GET',
                    headers: {
                        'User-Agent': request.headers.get('User-Agent') ?? '',
                    },
                });
                const resp = await fetch(upstream, {
                    cf: { cacheTtl: 3600, cacheEverything: true },
                });
                const headers = new Headers(resp.headers);
                headers.set('Cache-Control', 'public, max-age=3600');
                headers.delete('Set-Cookie');
                return new Response(resp.body, {
                    status: resp.status,
                    headers,
                });
            }
        }

        // 2. Collect endpoint — forward verbatim, never cache.
        //    Forward the real client IP and the visitor-location headers
        //    so umami's geo lookup works. See:
        //    https://docs.umami.is/docs/enable-cloudflare-headers
        //
        //    Headers we WANT to reach umami:
        //      - X-Forwarded-For (we set it from CF-Connecting-IP). umami
        //        with CLIENT_IP_HEADER=X-Forwarded-For reads from this.
        //      - CF-Connecting-IP (umami's default fallback for IP).
        //      - CF-IPCountry  (always sent by Cloudflare).
        //      - CF-IPCity, CF-RegionCode (only if you've enabled the
        //        "Add visitor location headers" Managed Transform on
        //        the bhatti.sh zone in Cloudflare).
        //
        //    Caveat: mymami.sahil-shubham.in is itself behind Cloudflare,
        //    and CF rewrites CF-* headers at its edge. So whether the
        //    upstream actually sees the geo headers depends on whether
        //    that zone is orange-clouded for the api/send hostname. If
        //    geo lands as "Unknown" after this change, set
        //    SKIP_LOCATION_HEADERS=1 on the umami container to force
        //    its local geo DB instead.
        if (url.pathname === `${PREFIX}api/send`) {
            // Origin guard. Browsers fetching from bhatti.sh always send
            // Origin: https://bhatti.sh. Anything else is either non-
            // browser abuse or a foreign-origin embed we don't want to
            // count, so reject early without burdening the upstream.
            if (request.headers.get('Origin') !== ALLOWED_ORIGIN) {
                return new Response('Forbidden', { status: 403 });
            }

            const headers = new Headers(request.headers);
            const clientIP = request.headers.get('CF-Connecting-IP');
            if (clientIP) headers.set('X-Forwarded-For', clientIP);
            // Drop only request-tracing noise. Keep CF-Connecting-IP and
            // CF-IPCountry / CF-IPCity / CF-RegionCode — umami uses them.
            headers.delete('Host');
            headers.delete('CF-Ray');
            headers.delete('CF-Visitor');

            return fetch(`${UPSTREAM}/api/send`, {
                method: request.method,
                headers,
                body: request.body,
            });
        }

        // 3. Everything else — static assets from dist/.
        return env.ASSETS.fetch(request);
    },
};
