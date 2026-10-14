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
