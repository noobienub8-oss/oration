# Oration — hackathon demo

A speaking-practice app with real student/teacher accounts. A student logs
in, records a 25-second impromptu answer, it's transcribed, summarized for a
teacher, and matched to recommended classroom exercises. A teacher logs into
their own account — on a different device, if you like — and taps Refresh to
see new submissions, plus a real cross-student leaderboard, streaks, and XP.

All three AI steps run on the **Gemini API** with a single key.

## Project structure

```
oration/
├── index.html            the whole app — auth, UI, recording, all 3 AI calls
├── assets/               Ori the mascot, three poses
├── supabase/schema.sql   run once in the Supabase SQL editor
├── wrangler.toml         local dev config
└── .gitignore
```

## 1. Create a Supabase project

1. [supabase.com](https://supabase.com) → **New project**. Free tier is plenty for this.
2. Once it's up, go to the **SQL Editor** → **New query**, paste in the full contents of `supabase/schema.sql`, and run it. This creates the `profiles` and `submissions` tables, the row-level security policies (students see only their own submissions, teachers see everyone's), the trigger that auto-creates a profile on signup, and enables realtime on `submissions`.
3. **Turn off email confirmation for the demo**: Authentication → Providers → Email → toggle off "Confirm email." Otherwise a fresh signup has to click a confirmation link before they can log in, which is a bad surprise mid-presentation.
4. Project Settings → **API** → copy the **Project URL** and the **anon public** key. These aren't secrets — they're safe to embed client-side, since actual access is enforced by the row-level security policies you just created, not by hiding this key.

## 2. Wire the Supabase keys into the code

`SUPABASE_URL` and `SUPABASE_ANON_KEY` near the top of `index.html`'s
`<script>` block are already filled in. If you ever spin up a new Supabase
project (or rotate the anon key), that's the only place to update.

## 3. Upload to GitHub

1. [github.com](https://github.com) → **New repository** → name it → **Create repository**. Leave it empty.
2. On the new repo's page, click **uploading an existing file**.
3. Drag in the *contents* of the `oration` folder: `index.html`, `README.md`, `wrangler.toml`, `.gitignore`, and the folders `assets/` and `supabase/`.
4. Add a commit message and **Commit changes** to `main`.

## 4. Connect Cloudflare Pages

1. [Cloudflare dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → pick the repo.
2. Framework preset: **None**. Build command: **blank**. Build output directory: **`/`**.
3. **Save and Deploy.**

No environment variables are needed any more — the Gemini key is entered in
the app itself and stored in the browser's local storage. If you previously
set `SARVAM_API_KEY` in the Cloudflare dashboard, you can delete it.

## 5. Add your Gemini key and try it

Open the live `*.pages.dev` URL. Sign up as a teacher in one browser (or an
incognito window), sign up as a student in another. Log in as the student,
click the gear icon, paste your Gemini API key, and save. Do the speaking
exercise. Switch to the teacher's window and tap **Refresh** — the submission
should be there.

### Getting a Gemini key

1. [aistudio.google.com](https://aistudio.google.com) → sign in → **Get API key** → **Create API key**.
2. The free tier covers a demo comfortably (Flash models, hundreds to ~1,000+
   requests/day). Paid credits only raise rate limits — they aren't required.

## Model handling

`GEMINI_MODELS` in the AI section of `index.html` lists the models tried in
order:

```js
const GEMINI_MODELS = ['gemini-3.7-flash', 'gemini-3.6-flash'];
```

A `404` (model retired, or not enabled for your key) or `503` (that model is
temporarily overloaded) falls through to the next entry. Any other error —
bad key, exhausted quota, malformed audio — throws immediately, since
retrying a different model wouldn't fix it.

Google retires Flash models aggressively. **Before a demo, check
[ai.google.dev/gemini-api/docs/models](https://ai.google.dev/gemini-api/docs/models)
and update this one line if either model is gone.** That's the only place
model names appear — all three AI calls read from it.

## If something breaks mid-demo

Settings → "Load sample data instead" renders a full canned example (for
whichever role you're logged in as) purely in the browser — it never touches
Supabase or Gemini. Safe fallback if wifi or the API hiccups on stage.

## Kept intentionally simple

Left out on purpose to keep the demo lean:
- **Teacher view uses a Refresh button, not a live subscription.** Fewer
  moving parts, nothing to silently disconnect mid-demo. Supabase Realtime is
  one `supabase.channel(...)` call away — see the comment above
  `fetchAndRenderTeacherSubmissions()`.
- **The Gemini key lives in the browser.** Fine for a hackathon demo where
  you're the only user. A real product would proxy these calls server-side so
  the key is never shipped to the client.
- XP and streak updates go straight from the browser to `profiles` with a
  plain `update`, gated only by "you can update your own row" — a
  technically-inclined user could set their own XP via devtools. A production
  version would move this into a Postgres RPC function.

## Gamification

- **XP:** +20 for a completed speaking exercise, +10 for a flashcard deck — synced to `profiles.xp`.
- **Streak:** consecutive calendar days with any activity, synced to `profiles.streak_count` / `last_active_date`.
- **Flashcards:** a 10-card deck of quick drills and public-speaking terms, shuffled each playthrough.
- **Leaderboard:** real signed-up students from `profiles`, sorted by XP. If fewer than 4 students exist yet, sample rows (clearly labeled) pad it out so it still looks like a class.
