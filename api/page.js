// Live shared pages: GET/PUT/DELETE /api/page?id=<id>
// Data lives in Upstash Redis (Vercel → Storage → Upstash Redis → connect to this project).
// Anyone with the id can read a page; only the holder of its secret key can change or delete it.
const { redis, hasRedis, validId, validKey, hash, parseBody, notify, TTL_SECONDS } = require("./_lib");

const MAX_BYTES = 32 * 1024;

// wishes in `next` that weren't in `prev` (by name), skipping ones already marked as received
function newWishes(prev, next) {
  const had = new Set(((prev && prev.wish) || []).map(w => String(w[0])));
  return ((next && next.wish) || []).filter(w => Array.isArray(w) && !w[3] && !had.has(String(w[0])));
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const id = req.query && req.query.id;

  // health check: lets the app know whether live sharing is switched on
  if (req.method === "GET" && !id) return res.status(200).json({ live: hasRedis() });
  if (!hasRedis()) return res.status(503).json({ error: "live sharing is not set up" });
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
    const prev = existing ? JSON.parse(existing) : null;
    if (prev && prev.k !== hash(key)) return res.status(403).json({ error: "not yours" });

    if (req.method === "PUT") {
      const body = parseBody(req.body);
      if (!body || typeof body !== "object" || Array.isArray(body)) return res.status(400).json({ error: "bad data" });
      const rec = JSON.stringify({ k: hash(key), u: Date.now(), d: body });
      if (Buffer.byteLength(rec) > MAX_BYTES) return res.status(413).json({ error: "too big" });
      await redis("SET", rkey, rec, "EX", String(TTL_SECONDS));

      const added = prev ? newWishes(prev.d, body) : [];
      if (added.length) {
        const who = String(body.her || "").trim().slice(0, 24) || "Your partner";
        const first = String(added[0][0]).slice(0, 80);
        await notify(id, {
          title: `🎀 ${who} added to the wishlist`,
          body: added.length === 1 ? `“${first}” ${"💗".repeat(Math.min(3, +added[0][2] || 1))}` : `“${first}” and ${added.length - 1} more`,
          url: `/?p=${id}`,
        }).catch(() => {}); // a failed notification never blocks saving
      }
      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      await redis("DEL", rkey);
      await redis("DEL", `subs:${id}`);
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, PUT, DELETE");
    return res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    return res.status(502).json({ error: "storage unavailable" });
  }
};
