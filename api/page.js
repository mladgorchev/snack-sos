// Live shared pages: GET/PUT/DELETE /api/page?id=<id>
// Data lives in Upstash Redis (Vercel → Storage → Upstash Redis → connect to this project).
// Anyone with the id can read a page; only the holder of its secret key can change or delete it.
const crypto = require("crypto");

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const MAX_BYTES = 32 * 1024;
const TTL_SECONDS = 60 * 60 * 24 * 400; // pages nobody updates for ~13 months are cleaned up

const validId = id => typeof id === "string" && /^[A-Za-z0-9]{12}$/.test(id);
const validKey = k => typeof k === "string" && /^[A-Za-z0-9]{32,64}$/.test(k);
const hash = k => crypto.createHash("sha256").update(k).digest("hex");

async function redis(...cmd) {
  const r = await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error(`redis ${r.status}`);
  return (await r.json()).result;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const id = req.query && req.query.id;

  // health check: lets the app know whether live sharing is switched on
  if (req.method === "GET" && !id) return res.status(200).json({ live: !!(REDIS_URL && REDIS_TOKEN) });
  if (!REDIS_URL || !REDIS_TOKEN) return res.status(503).json({ error: "live sharing is not set up" });
  if (!validId(id)) return res.status(400).json({ error: "bad id" });
  const rkey = `page:${id}`;

  try {
    if (req.method === "GET") {
      const raw = await redis("GET", rkey);
      if (!raw) return res.status(404).json({ error: "not found" });
      const rec = JSON.parse(raw);
      return res.status(200).json({ data: rec.d, updated: rec.u });
    }

    const key = req.headers["x-page-key"];
    if (!validKey(key)) return res.status(401).json({ error: "missing key" });
    const existing = await redis("GET", rkey);
    if (existing && JSON.parse(existing).k !== hash(key)) return res.status(403).json({ error: "not yours" });

    if (req.method === "PUT") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "null") : req.body;
      if (!body || typeof body !== "object" || Array.isArray(body)) return res.status(400).json({ error: "bad data" });
      const rec = JSON.stringify({ k: hash(key), u: Date.now(), d: body });
      if (Buffer.byteLength(rec) > MAX_BYTES) return res.status(413).json({ error: "too big" });
      await redis("SET", rkey, rec, "EX", String(TTL_SECONDS));
      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      await redis("DEL", rkey);
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, PUT, DELETE");
    return res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    return res.status(502).json({ error: "storage unavailable" });
  }
};
