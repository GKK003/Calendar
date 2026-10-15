# Our Calendar

A shared work & study calendar for two people. React (Vite) + Supabase.
Works on desktop and phone, syncs live between both of you.

## Features
- Month grid with every day of the year, plus a **Year** overview
- Event types: Work, Study, Important, Personal (filter by type, by person, and search)
- Time or all-day events, notes, and **repeat weekly** (great for class/shift schedules)
- Live sync: when she adds something, you see it instantly
- Phone layout: compact month with dots, day agenda below, big + button, bottom-sheet form, bottom tab bar
- Private: login required, only the two of you can see the data

## 1. Create the backend (5 minutes, free)
1. Go to https://supabase.com, create a project.
2. Open **SQL Editor → New query**, paste the whole content of `supabase/schema.sql`, click **Run**.
3. (Recommended) **Authentication → Providers → Email**: turn **off** "Confirm email" so sign-up works instantly.
4. **Project Settings → API**: copy the **Project URL** and the **anon public key**.

## 2. Run it
```bash
npm install
cp .env.example .env     # then paste your URL and key into .env
npm run dev
```
Open the link it prints. On your phone (same Wi-Fi) open the "Network" link.

## 3. Use it together
- You: sign up → **Start new** → you get an invite code at the top.
- Her: sign up → **Join with code** → enter the code.
- Only two people can join one calendar.

Tips: tap a day to see its events; double-click a day (desktop) or tap **+** to add one.

## 4. Put it online (so it works on phones anywhere)
Deploy the folder to Vercel or Netlify (free):
- Build command: `npm run build`, output folder: `dist`
- Add the two environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- In Supabase **Authentication → URL Configuration**, add your site URL.
Then on the phone, open the site and choose **Add to Home Screen** to use it like an app.

## 5. Phone notifications and ringing calls (one-time setup)
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

## 6. More than two people, and Messenger-style chats (one-time update)
The Chat page now shows a list like Messenger: **one group chat** (everybody) and **a private chat with each other person**, each with the profile picture, name, last message and unread count. Up to 6 people can join with the same invite code (shown at the top of the app). Calls stay one-to-one, from a private chat.

Do this once, in this order:
1. **Database:** Supabase -> SQL Editor -> New query -> paste all of `supabase/three-people.sql` -> Run. Do this *before* the new person joins. Everything you two wrote until now becomes your private chat, the new person will not see it.
2. **Function:** Supabase -> Edge Functions -> `notify` -> paste the new `supabase/functions/notify/index.ts` over the old code -> Deploy (keep Verify JWT off). This makes group messages go to everybody and private messages only to that person.
3. **App:** upload the project (it includes the new `public/sw.js`) and redeploy.
4. **On each phone:** close the app completely and open it again once so the new version loads. Then the new person joins with the invite code.

Notes: the chat colour, nicknames and quick reaction are shared by all chats. Time zones still offer only Tbilisi and New York.
