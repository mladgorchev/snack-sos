# Snack SOS 🧸

A tiny, cute page for couples, for rough days, cosy nights and gift ideas:

- **Comfort orders**: pick how you're feeling (long day, poorly, period days…) and what would help (chocolate, tea, cuddles…), then send it to your partner on WhatsApp or by text.
- **Wishlist**: things you'd love, with 1–3 hearts for how much you want them.
- **Share my page**: send your partner a view-only link to your wishlist and comfort menu.
- **Notes** 📝: jot down little things your partner mentions (gift ideas, sizes, loves, not-a-fans) so you remember when it counts. Kept only on your phone.
- **New-wish notifications** 🔔: when you follow your partner's live page, you can get a notification each time they add a wish. On iPhone this needs the page added to the home screen first (iOS 16.4+).
- **Cycle heads-up** (optional): a reminder in the app, and in your phone's calendar, a couple of days before your period. Kept only on your phone and never shared.

It's a single static `index.html` with no build step, plus two small serverless functions (`api/page.js` for live sharing, `api/push.js` for notification sign-ups) and a service worker (`sw.js`) that only shows notifications. Your menu and wishlist are saved in your browser (localStorage) on your own phone.

## Deploy to Vercel

Import the GitHub repo in Vercel (Add New → Project), choose framework preset **Other**, leave the build settings empty, and click Deploy. Every push redeploys automatically.

## Turn on live sharing (optional, one-time)

Without this, "Share my page" sends a **snapshot** link: the list is packed into the link itself, so the partner needs a new link after changes.

With it, the link always shows the latest list:

1. In your Vercel project, open **Storage → Create Database → Upstash (Redis)**, pick the free plan, and connect it to this project.
2. Redeploy (Deployments → ⋯ → Redeploy) so the new settings are picked up.

The app checks `/api/page` on load and switches to live links automatically. Notifications need no extra setup: push keys are generated once and kept in the same database (or set `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` yourself). Pages are readable by anyone with the link; only the phone that created a page can change or delete it ("Stop sharing" in settings).

## Add it to your home screen
Open your Vercel link on your phone → Share → **Add to Home Screen** (iPhone) or ⋮ → **Add to Home screen** (Android).
