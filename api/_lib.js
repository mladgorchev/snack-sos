// Shared helpers for the API routes (the leading underscore keeps Vercel from serving this as a route).
const crypto = require("crypto");
const webpush = require("web-push");

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const TTL_SECONDS = 60 * 60 * 24 * 400; // pages nobody updates for ~13 months are cleaned up

const hasRedis = () => !!(REDIS_URL && REDIS_TOKEN);
const validId = id => typeof id === "string" && /^[A-Za-z0-9]{12}$/.test(id);
const validKey = k => typeof k === "string" && /^[A-Za-z0-9]{32,64}$/.test(k);
const hash = k => crypto.createHash("sha256").update(k).digest("hex");
const parseBody = b => (typeof b === "string" ? JSON.parse(b || "null") : b);

async function redis(...cmd) {
  const r = await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error(`redis ${r.status}`);
  return (await r.json()).result;
}

// Push keys come from env vars if set; otherwise they're generated once and kept in Redis,
// so notifications work with no extra setup.
let vapid = null;
async function vapidKeys() {
  if (vapid) return vapid;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    vapid = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  } else {
    await redis("SET", "vapid", JSON.stringify(webpush.generateVAPIDKeys()), "NX");
    vapid = JSON.parse(await redis("GET", "vapid"));
  }
  return vapid;
}

// Sends a notification to every phone following a page; drops subscriptions the browser has retired.
async function notify(pageId, payload) {
  const subs = (await redis("SMEMBERS", `subs:${pageId}`)) || [];
  if (!subs.length) return;
  const { publicKey, privateKey } = await vapidKeys();
  const subject = process.env.VAPID_SUBJECT || "https://github.com/mladgorchev/snack-sos";
  await Promise.all(subs.map(async raw => {
    try {
      await webpush.sendNotification(JSON.parse(raw), JSON.stringify(payload), {
        TTL: 60 * 60 * 24, vapidDetails: { subject, publicKey, privateKey },
      });
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) await redis("SREM", `subs:${pageId}`, raw);
    }
  }));
}

module.exports = { redis, hasRedis, validId, validKey, hash, parseBody, vapidKeys, notify, TTL_SECONDS };
