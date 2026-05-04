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

export default {
    /**
     * @param {Request} request
     * @param {{ ASSETS: Fetcher }} env
     */
    async fetch(request, env) {
        const url = new URL(request.url);

        // 1. Tracker script — cache at the edge for an hour. Umami releases
        //    are infrequent (weeks), so this is plenty fresh while keeping
        //    origin load near-zero.
        if (url.pathname === `${PREFIX}script.js`) {
            const upstream = new Request(`${UPSTREAM}/script.js`, {
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

        // 2. Collect endpoint — forward verbatim, never cache.
        //    Preserve the real client IP so Umami's geo + unique-visitor
        //    logic doesn't see every request as coming from one Cloudflare
        //    egress IP. This requires CLIENT_IP_HEADER=X-Forwarded-For on
        //    the Umami server.
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
            // Strip the inbound Host so fetch() sets it from UPSTREAM, and
            // strip Cloudflare-internal headers that shouldn't leak to the
            // origin.
            headers.delete('Host');
            headers.delete('CF-Connecting-IP');
            headers.delete('CF-IPCountry');
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
