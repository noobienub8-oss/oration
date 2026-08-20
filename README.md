# Oration — hackathon demo

A speaking-practice app with real student/teacher accounts. A student logs
in, records a 25-second impromptu answer, it's transcribed (Sarvam, falling
back to Gemini if Sarvam fails), summarized for a teacher (Groq), and matched
to recommended classroom exercises (OpenRouter). A teacher logs into their
own account — on a different device, if you like — and taps Refresh to see
new submissions, plus a real cross-student leaderboard, streaks, and XP.

## Project structure

```
oration/
├── index.html                     the whole app — auth, UI, recording, all 4 AI calls
├── assets/                        Ori the mascot, three poses
├── functions/sarvam-transcribe.js Cloudflare Pages Function — proxies the Sarvam call
├── supabase/schema.sql            run once in the Supabase SQL editor
├── wrangler.toml                  local dev config
└── .gitignore
```

## 1. Create a Supabase project

1. [supabase.com](https://supabase.com) → **New project**. Free tier is plenty for this.
2. Once it's up, go to the **SQL Editor** → **New query**, paste in the full contents of `supabase/schema.sql`, and run it. This creates the `profiles` and `submissions` tables, the row-level security policies (students see only their own submissions, teachers see everyone's), the trigger that auto-creates a profile on signup, and enables realtime on `submissions`.
3. **Turn off email confirmation for the demo**: Authentication → Providers → Email → toggle off "Confirm email." Otherwise a fresh signup has to click a confirmation link before they can log in, which is a bad surprise mid-presentation. (Turn it back on later if this becomes a real product.)
4. Project Settings → **API** → copy the **Project URL** and the **anon public** key. These aren't secrets — they're safe to embed client-side, since actual access is enforced by the row-level security policies you just created, not by hiding this key.

## 2. Wire the keys into the code

**Already done in this copy** — `SUPABASE_URL` and `SUPABASE_ANON_KEY` near
the top of `index.html`'s `<script>` block are filled in with your project's
values already. If you ever spin up a new Supabase project (or rotate the
anon key), that's the only place to update — the Cloudflare function doesn't
need these, it only talks to Sarvam.

## 3. Upload to GitHub

1. [github.com](https://github.com) → **New repository** → name it (e.g. `oration-demo`) → **Create repository**. Leave it empty (don't add a README/gitignore on GitHub's side).
2. On the new repo's page, click **uploading an existing file**.
3. Drag in the *contents* of the `oration` folder — not the outer `oration` folder itself, its contents: `index.html`, `README.md`, `wrangler.toml`, `.gitignore`, and the three folders `assets/`, `functions/`, `supabase/`. Modern browsers preserve folder structure when you drag folders straight into GitHub's upload box, so dragging the `assets` folder icon (etc.) keeps the files nested correctly — you don't need to open each folder and upload its contents separately.
4. Scroll down, add a commit message like "Initial commit," and click **Commit changes** (committing straight to `main` is fine here).
5. Double check the repo afterward: `assets/ori-wave.png`, `functions/sarvam-transcribe.js`, and `supabase/schema.sql` should each show up nested inside their folders, not dumped flat into the root. If a folder didn't come through, open it and re-upload just that one.

## 4. Connect Cloudflare Pages

1. [Cloudflare dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → pick the repo.
2. Framework preset: **None**. Build command: **blank**. Build output directory: **`/`**.
3. **Save and Deploy.** Cloudflare auto-detects `functions/sarvam-transcribe.js` and serves it at `/sarvam-transcribe`.

## 5. Add the Sarvam key

1. Pages project → **Settings** → **Environment variables** → add `SARVAM_API_KEY` for both Production and Preview.
2. **Deployments** → redeploy the latest one so the function picks it up.

## 6. Try it

Open the live `*.pages.dev` URL. Sign up as a teacher on one browser (or incognito window), sign up as a student on another. Log in as the student, do the speaking exercise, gear icon → paste your Groq/OpenRouter/Gemini keys first if you haven't. Switch to the teacher's window and tap **Refresh** — the submission should be there.

## Why Sarvam is handled differently from the other three

Groq, OpenRouter, and Gemini all document direct browser calls (CORS-enabled),
so those stay client-side. Sarvam's docs don't confirm CORS support either
way, so that call goes through the Cloudflare Pages Function instead — a
server-to-server hop where CORS doesn't apply.

## Automatic fallback: Sarvam → Gemini

If Sarvam fails for any reason, the app retries transcription with Gemini
directly from the browser. A note appears under "Transcribing" when this
happens, and the teacher dashboard flags which provider actually produced
each transcript.

## If something breaks mid-demo

Settings → "Load sample data instead" renders a full canned example (for
whichever role you're logged in as) purely in the browser — it never touches
Supabase. Safe fallback if wifi or a provider hiccups on stage.

## Kept intentionally simple

Two things a production version would add back, left out here on purpose to
keep the demo lean and easy to reason about under time pressure:
- **Teacher view uses a Refresh button, not a live subscription.** Fewer
  moving parts, nothing to silently disconnect mid-demo. Supabase Realtime
  is one `supabase.channel(...)` call away if you want it later — see the
  comment above `fetchAndRenderTeacherSubmissions()`.
- **The `/sarvam-transcribe` function doesn't check who's calling it.**
  Anyone who finds the URL could call it directly. Fine for a hackathon demo;
  before this is a real public product, add a login check back in (verify
  the caller's Supabase access token against `${SUPABASE_URL}/auth/v1/user`
  before proxying to Sarvam).
- XP and streak updates go straight from the browser to `profiles` with a
  plain `update`, gated only by "you can update your own row" — a
  technically-inclined user could set their own XP to anything via devtools.
  A production version would move this into a Postgres RPC function instead
  of trusting the client's number.

## Setting up the three (well, four) APIs

### Sarvam
1. [dashboard.sarvam.ai](https://dashboard.sarvam.ai) → sign up.
2. Once in, find **API Keys** in the dashboard → create a key. You get free
   credits on signup, plenty for a demo.
3. This is the one that goes into Cloudflare as `SARVAM_API_KEY` (step 5
   above), not into the app's Settings panel.

### Groq
1. [console.groq.com](https://console.groq.com) → sign up.
2. **API Keys** in the left sidebar → **Create API Key**. Copy it immediately,
   it's only shown once.
3. Free tier, no card needed. Paste this into the app's Settings (gear icon)
   after you're logged in.

### OpenRouter
1. [openrouter.ai](https://openrouter.ai) → sign up.
2. **Keys** (under your account menu) → **Create Key**.
3. This app uses a `:free`-suffixed model, so no credits needed. Paste into
   Settings alongside the Groq key.

### Gemini (the fallback)
1. [aistudio.google.com](https://aistudio.google.com) → sign in with a
   Google account → **Get API key** → **Create API key**.
2. Free tier, no card needed. Paste into Settings — this one only gets used
   if the Sarvam call fails.

All four keys are entered once, in the running app itself (or, for Sarvam,
in Cloudflare's dashboard) — none of them need to be hardcoded into the
source beyond the Supabase URL/key in step 2 above.

## Test locally before you deploy

```
npm install -g wrangler
wrangler pages dev .
```
Create a `.dev.vars` file (gitignored, don't commit it) with:
```
SARVAM_API_KEY=your_key_here
```

## Gamification

- **XP:** +20 for a completed speaking exercise, +10 for a flashcard deck — synced to `profiles.xp`.
- **Streak:** consecutive calendar days with any activity, synced to `profiles.streak_count` / `last_active_date`.
- **Flashcards:** a 10-card deck of quick drills and public-speaking terms, shuffled each playthrough.
- **Leaderboard:** real signed-up students from `profiles`, sorted by XP. If fewer than 4 students exist yet, sample rows (clearly labeled) pad it out so it still looks like a class.
