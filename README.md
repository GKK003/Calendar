# Our Calendar

A shared work & study calendar for up to six people. React (Vite) + Supabase.
Works on desktop and phone, with live sync for everyone in the shared space.

## Features
- Month grid with every day of the year, plus a **Year** overview
- Event types: Work, Study, Important, Personal, Special (filter by type, by person, and search)
- Time or all-day events, notes, and **repeat weekly** (great for class/shift schedules)
- Live sync: when she adds something, you see it instantly
- Phone layout: compact month with dots, day agenda below, big + button, bottom-sheet form, bottom tab bar
- Private: login required; members of a shared space can see its shared data

## 1. Create the backend (5 minutes, free)
1. Go to https://supabase.com, create a project.
2. Open **SQL Editor → New query**, paste the whole content of `supabase/schema.sql`, click **Run**.
3. Run `supabase/chat.sql`, then `supabase/three-people.sql`, in that order. The current Chat page needs both; run them before inviting a third person.
4. Run `supabase/social.sql`, `supabase/cinema.sql`, and `supabase/games.sql` to enable profile photos, posts, Cinema, and shared games.
5. Run `supabase/pet.sql` to enable the shared virtual pet, room, care progress, and furniture collection. Pets, room styles, and decor are all free. Existing projects need to run this once before opening Pet Room.
6. (Recommended) **Authentication → Providers → Email**: turn **off** "Confirm email" so sign-up works instantly.
7. **Project Settings → API**: copy the **Project URL** and the **anon public key**.

## 2. Run it
Use Node.js 20.19+ or 22.12+.

```bash
npm install
cp .env.example .env     # then paste your URL and key into .env
npm run dev
```
Open the link it prints. On your phone (same Wi-Fi) open the "Network" link.

## 3. Use it together
- You: sign up → **Start new** → you get an invite code at the top.
- Her: sign up → **Join with code** → enter the code.
- Up to six people can join one calendar. Each account can join one shared space.

Tips: tap a day to see its events; double-click a day (desktop) or tap **+** to add one.

## 4. Put it online (so it works on phones anywhere)
Deploy the folder to Vercel or Netlify (free):
- Build command: `npm run build`, output folder: `dist`
- Add the two environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- In Supabase **Authentication → URL Configuration**, add your site URL.
Then on the phone, open the site and choose **Add to Home Screen** to use it like an app.

## 5. Cinema video uploads (one-time setup)

Cinema stores large videos in Cloudflare R2 and keeps library metadata in Supabase. Create an R2 bucket and an R2 API token with read/write access to that bucket only. Configure the bucket's CORS policy with your deployed site origin (and `http://localhost:5173` for local development):

```json
[
  {
    "AllowedOrigins": ["https://YOUR-SITE.example", "http://localhost:5173"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Link the Supabase project with the CLI, set the R2 credentials as Edge Function secrets, then deploy the authenticated function:

```bash
supabase secrets set R2_ACCOUNT_ID=YOUR_ACCOUNT_ID R2_ACCESS_KEY_ID=YOUR_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY=YOUR_SECRET_ACCESS_KEY R2_BUCKET=YOUR_BUCKET_NAME
supabase functions deploy r2
```

The app requests short-lived upload and playback links from this function. Keep R2 credentials in Edge Function secrets; never put them in `.env` or a `VITE_` variable.

## 6. Phone notifications and ringing calls (one-time setup)
What you get: Messenger-style alerts (name on top, message text under it) and, for calls, an "Incoming call" alert with sound and vibration that repeats every 5 seconds for about 30 seconds, until she answers or you hang up. A web app cannot show a real full-screen call, this is the closest it gets.

Each phone: Android works in the browser or as an installed app. iPhone (iOS 16.4+) works only after **Share → Add to Home Screen**, then open the app from the home screen icon.

1. **Make the two keys** (run once, on your computer):
   ```bash
   npx web-push generate-vapid-keys
   ```
   Keep the **Public** and **Private** keys. Also make up a long random password for `WEBHOOK_SECRET`.
2. **Put the public key in the app**: in `.env` (and in Vercel/Netlify environment variables) set `VITE_VAPID_PUBLIC_KEY=<public key>`, then redeploy.
3. **Create the table and trigger**: open `supabase/push.sql`, replace the two `CHANGE ME` values (your project URL and the same `WEBHOOK_SECRET`), paste it into Supabase **SQL Editor** and Run.
4. **Deploy the function** (needs the Supabase CLI):
   ```bash
   supabase login
   supabase link --project-ref YOUR-PROJECT-REF
   supabase secrets set VAPID_PUBLIC_KEY=<public> VAPID_PRIVATE_KEY=<private> VAPID_SUBJECT=mailto:you@example.com WEBHOOK_SECRET=<same secret as step 3>
   supabase functions deploy notify --no-verify-jwt
   ```
5. **Turn it on, on each phone**: open the app from the home screen, tap **Turn on** in the banner (or Chat → Settings → Notifications) and allow notifications.

Test: lock one phone, send a message from the other. If nothing arrives, check Supabase → Edge Functions → notify → Logs.

## 7. Multi-person chat
The Chat page shows **one group chat** (everybody) and **a private chat with each other person**, each with a profile picture, name, last message, and unread count. Up to six people can join one space. Calls stay one-to-one, from a private chat.

The initial setup runs `supabase/chat.sql` and then `supabase/three-people.sql`. For an existing database, run `chat.sql` if the chat tables are missing, then run `three-people.sql` once before inviting a third person. That migration moves existing two-person messages into their private chat. Deploy `supabase/functions/notify/index.ts` to the `notify` Edge Function if you use push notifications.

Notes: the chat colour, nicknames and quick reaction are shared by all chats. Time zones still offer only Tbilisi and New York.

## Shared Wordle and Sudoku

The initial setup runs `supabase/games.sql`. If adding Games to an older setup, run that file after `supabase/schema.sql`.

1. In Supabase, open **Database → Publications** and confirm `shared_games` is included in `supabase_realtime` (the SQL migration adds it automatically when permissions allow).
2. Install dependencies with `npm install`, then run `npm run dev`.
3. Sign in with two accounts joined to the same shared space, open **Games**, and select Wordle or Sudoku. Both people use the same board; moves are stored in Supabase and broadcast with Realtime.

The game table is protected by row-level security so signed-in users can access only their own shared space. Wordle's answer is currently part of the shared game state, so this is intended for casual cooperative play rather than cheat-resistant competitive play. For competitive play, move answer selection and guess scoring into a server-side database function or trusted backend.
