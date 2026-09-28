# Snack SOS 🧸

A tiny, cute page for couples:

- **Comfort orders**: pick your mood and what would help (chocolate, hot water bottle, cuddles…), then send it to your partner on WhatsApp or by text.
- **Wishlist**: things you'd love, with 1–3 hearts for how much you want them.

It's a single static `index.html` with no build step and no dependencies. Your menu and wishlist are saved in your browser (localStorage) on your own phone.

## Deploy to Vercel

**Option A: GitHub + Vercel**
1. The code lives in the `snack-sos` GitHub repo.
2. Go to vercel.com → Add New → Project → import the repo.
3. Framework preset: **Other**. No build command. Click Deploy.

**Option B: Vercel CLI**
```bash
npm i -g vercel
vercel        # follow the prompts, then:
vercel --prod
```

## Add it to your home screen
Open your Vercel link on your phone → Share → **Add to Home Screen** (iPhone) or ⋮ → **Add to Home screen** (Android).

## Ideas for later
- Shared storage (e.g. Vercel KV or Supabase) so your partner can open the wishlist live
- A "he's on his way 🏃‍♂️" reply button
- Push notifications
