# HisabMate — Live করার গাইড (Vercel + Supabase · অনলাইন + অফলাইন)

এই গাইড অনুসরণ করলে HisabMate একটাই বিল্ডে **দুই সিস্টেমে** চলবে:

- **অফলাইন:** নেট ছাড়াও পুরো অ্যাপ চলে। এন্ট্রি ফোনে (IndexedDB) জমা থাকে, PWA হিসেবে হোম স্ক্রিনে ইনস্টল করা যায়।
- **অনলাইন:** নেট এলে সব এন্ট্রি নিজে থেকেই ক্লাউডে (Supabase) সিঙ্ক হয় — অ্যাকাউন্ট, ব্যাকআপ, একাধিক ফোনে একই ডেটা।

> এই "দুই সিস্টেম" পেতে আলাদা কোড লাগে না। শুধু বিল্ডের সময় Supabase-এর env সেট করলেই অফলাইন-সিঙ্ক (outbox) ব্যবস্থা চালু হয়ে যায়। env না দিলে অ্যাপ শুধু অন-ডিভাইস (অফলাইন-only) মোডে চলবে।

---

## ধাপ ১ — Supabase (ক্লাউড) সেটআপ

1. [supabase.com](https://supabase.com)-এ একটা প্রজেক্ট বানান। ডেটাবেজ তৈরি শেষ হওয়া পর্যন্ত অপেক্ষা করুন।

2. **স্কিমা রান করুন।** ড্যাশবোর্ডে **SQL Editor** খুলে এই দুটো ফাইল ক্রমানুসারে চালান:
   - `supabase/migrations/0001_init.sql` — টেবিল, ইনডেক্স, ট্রিগার
   - `supabase/migrations/0002_rls.sql` — Row-Level Security (প্রতি ইউজারের ডেটা আলাদা)

   অথবা Supabase CLI দিয়ে:

   ```bash
   supabase link --project-ref <your-ref>
   supabase db push
   ```

3. **কী নিন।** **Settings → API** থেকে দুটো জিনিস কপি করুন:
   - Project URL (যেমন `https://xxxx.supabase.co`)
   - `anon` **public** key

   > ⚠️ শুধু **anon** key ফ্রন্টএন্ডে দেওয়া নিরাপদ। **service_role key কখনো** env বা কোডে দেবেন না — ওটা RLS বাইপাস করে।

4. **Auth চালু করুন।** **Authentication → Providers**-এ Email ডিফল্টে চালু। পরে Vercel URL পেলে **Authentication → URL Configuration**-এ সেটা Site URL + Redirect URL হিসেবে যোগ করবেন (ধাপ ৩)।

---

## ধাপ ২ — কোড GitHub-এ তুলুন

Vercel-এর সবচেয়ে সহজ উপায় হলো একটা Git রিপো কানেক্ট করা।

```bash
cd hisabmate
git init
git add .
git commit -m "HisabMate ready to deploy"
# GitHub-এ একটা খালি রিপো বানিয়ে:
git remote add origin https://github.com/<you>/hisabmate.git
git branch -M main
git push -u origin main
```

> `.env` কমিট হবে না (git-ignored) — env আমরা Vercel-এ দেব, রিপোতে নয়।

---

## ধাপ ৩ — Vercel-এ ডিপ্লয় + env

1. [vercel.com](https://vercel.com)-এ GitHub দিয়ে লগইন → **Add New → Project** → আপনার `hisabmate` রিপো ইমপোর্ট করুন।

2. Framework নিজে থেকেই **Vite** ধরবে। রিপোতে থাকা `vercel.json`-ই বিল্ড (`npm run build`), আউটপুট (`dist`), আর SPA রাউটিং সামলাবে — আলাদা কিছু বদলাতে হবে না।

3. **Environment Variables**-এ এগুলো যোগ করুন (এগুলো না দিলে অ্যাপ অফলাইন-only মোডে থাকবে, ক্লাউড সিঙ্ক হবে না):

   | Name | Value |
   | --- | --- |
   | `VITE_DATA_BACKEND` | `supabase` |
   | `VITE_SUPABASE_URL` | `https://YOUR-PROJECT.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | `YOUR-ANON-KEY` |
   | `VITE_DEFAULT_LANG` | `bn` *(ঐচ্ছিক)* |
   | `VITE_DEFAULT_CURRENCY` | `৳` *(ঐচ্ছিক)* |

4. **Deploy** চাপুন। শেষ হলে একটা লাইভ URL পাবেন (যেমন `https://hisabmate.vercel.app`)।

5. সেই URL-টা Supabase-এ **Authentication → URL Configuration**-এ Site URL ও Redirect URL হিসেবে যোগ করুন (নাহলে সাইনআপ/লগইন রিডাইরেক্ট আটকাতে পারে)।

> **CLI বিকল্প:** `npm i -g vercel` → প্রজেক্ট ফোল্ডারে `vercel` → env যোগ করে `vercel --prod`।

---

## ধাপ ৪ — যাচাই

- লাইভ URL খুলুন → সাইনআপ করুন (প্রথমবার অ্যাকাউন্ট বানাতে নেট লাগবে) → ব্যবসার তথ্য দিন।
- ফোনে ব্রাউজারের মেন্যু থেকে **"Add to Home Screen"** — অ্যাপের মতো ইনস্টল হবে।
- **অফলাইন টেস্ট:** নেট বন্ধ করে একটা এন্ট্রি দিন — উপরে "offline" স্ট্যাটাস দেখাবে, এন্ট্রি সেভ হবে। নেট চালু করলে নিজে থেকে সিঙ্ক হয়ে "synced" দেখাবে।
- আরেকটা ফোনে একই অ্যাকাউন্টে লগইন করে দেখুন ডেটা এসেছে কিনা।

---

## নিরাপত্তা (মনে রাখবেন)

- ফ্রন্টএন্ডে **শুধু anon key** — service_role key নয়।
- ডেটা সুরক্ষা RLS দিয়ে: একজন ইউজার শুধু নিজের ব্যবসার সারি পড়তে/লিখতে পারে।
- `.env` ফাইল কখনো Git-এ কমিট করবেন না।

---

## শুধু অফলাইন চাইলে (ব্যাকএন্ড ছাড়া)

ক্লাউড দরকার না হলে Vercel-এ env-গুলো **দেবেন না** (বা `VITE_DATA_BACKEND=mock`)। তখন প্রতিটা ফোন নিজের ডেটা নিজের কাছেই রাখবে, কোনো সার্ভার/খরচ ছাড়াই অ্যাপ চলবে। পরে যেকোনো সময় শুধু env যোগ করে রি-ডিপ্লয় করলেই ক্লাউড সিঙ্ক চালু হয়ে যাবে — কোড বদলাতে হবে না।

---

## দ্রুত রেফারেন্স

```bash
npm install          # নির্ভরতা
npm run build        # tsc টাইপ-চেক + প্রোডাকশন বিল্ড → dist/
npm run preview      # বিল্ডটা লোকালি দেখে নেওয়া
```

ডিপ্লয়ের আগে অন্তত একবার লোকালি `npm run build` চালিয়ে নিশ্চিত হোন টাইপ-চেক পাস করছে।
