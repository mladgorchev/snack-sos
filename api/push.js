// Notification sign-ups for a shared page.
//   GET               → the public key browsers need to subscribe
//   POST   ?id=<id>   → body: the browser's PushSubscription; start notifying this phone
//   DELETE ?id=<id>   → body: { endpoint }; stop notifying this phone
const { redis, hasRedis, validId, parseBody, vapidKeys, TTL_SECONDS } = require("./_lib");

const MAX_SUBS = 20;

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!hasRedis()) return res.status(503).json({ error: "live sharing is not set up" });

  try {
    if (req.method === "GET") return res.status(200).json({ publicKey: (await vapidKeys()).publicKey });

    const id = req.query && req.query.id;
    if (!validId(id)) return res.status(400).json({ error: "bad id" });
    const key = `subs:${id}`;
    const body = parseBody(req.body) || {};

    if (req.method === "POST") {
      const { endpoint, keys } = body;
      if (typeof endpoint !== "string" || !/^https:\/\//.test(endpoint) || endpoint.length > 1000 ||
          !keys || typeof keys.p256dh !== "string" || typeof keys.auth !== "string") {
        return res.status(400).json({ error: "bad subscription" });
      }
      if (!(await redis("EXISTS", `page:${id}`))) return res.status(404).json({ error: "not found" });
      const subs = (await redis("SMEMBERS", key)) || [];
      const clean = JSON.stringify({ endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } });
      if (!subs.includes(clean) && subs.length >= MAX_SUBS) return res.status(429).json({ error: "too many" });
      await redis("SADD", key, clean);
      await redis("EXPIRE", key, String(TTL_SECONDS));
      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      const subs = (await redis("SMEMBERS", key)) || [];
      await Promise.all(subs.filter(s => JSON.parse(s).endpoint === body.endpoint).map(s => redis("SREM", key, s)));
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    return res.status(502).json({ error: "storage unavailable" });
  }
};
