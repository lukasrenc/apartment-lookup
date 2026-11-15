// Cloudflare Worker: Sreality street-ID lookup for the Apartment Lookup page.
//
// The page needs Sreality's numeric street ID for the 500 m search, but browsers
// block a page on your domain from asking Sreality for it. This Worker asks
// instead and passes the answer back.
//
// It only ever calls Sreality's street lookup, only accepts a few known
// parameters, and only answers your own site (ALLOWED_ORIGIN).
//
// Setup: dash.cloudflare.com → Workers & Pages → Create → Create Worker →
// Deploy → Edit code → paste this file → change ALLOWED_ORIGIN → Deploy.
// Then put the Worker's address into SUGGEST_PROXY in index.html.

const ALLOWED_ORIGIN = "https://YOUR-SITE.example"; // ← your site, e.g. "https://www.example.cz" (no trailing slash)

const SUGGEST_URL = "https://www.sreality.cz/api/v1/localities/suggest";
const ALLOWED_PARAMS = ["phrase", "category", "locality_country_id", "lang", "limit", "lat", "lon"];

export default {
  async fetch(request) {
    const cors = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Accept",
      "Vary": "Origin",
    };

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "GET") return new Response("Method not allowed", { status: 405, headers: cors });

    const incoming = new URL(request.url);
    const target = new URL(SUGGEST_URL);
    for (const key of ALLOWED_PARAMS) {
      const value = incoming.searchParams.get(key);
      if (value) target.searchParams.set(key, value.slice(0, 200));
    }
    if (!target.searchParams.get("phrase") && !target.searchParams.get("lat")) {
      return new Response('{"error":"missing phrase"}', {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
      });
    }

    const upstream = await fetch(target, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (apartment-lookup street-ID helper)",
      },
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        ...cors,
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=86400", // street IDs rarely change
      },
    });
  },
};
