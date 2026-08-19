# HisabMate

**A premium digital khata (business ledger) for small shops — offline-first, Bangla + English.**

HisabMate helps a shopkeeper track customers and suppliers, record credit and
payments, log expenses, and see exactly who owes what — on a phone. It is a
mobile-first Progressive Web App: install it to the home screen and it behaves
like a native app. Used without an account, every feature runs on the device
with no internet at all; add a cloud account when you want a server-side copy.

> HisabMate is an original product with its own visual identity
> (**Jade · Midnight · Coin-gold**). It is not a clone of any existing khata app.

---

## Highlights

- **Customers & suppliers** with running balances, credit limits, due dates, and
  a GREEN / YELLOW / RED health status.
- **Ledger** of every transaction — money received, money paid, credit sales,
  and refunds — with payment method (Cash, bKash, Nagad, Bank, Other).
- **Expenses** across eight categories with a monthly breakdown.
- **Reports**: daily / weekly / monthly collection, sales, expenses, estimated
  profit, cash-flow trend, and outstanding receivables vs payables.
- **Reminders** to nudge customers about dues via WhatsApp or copy-to-clipboard.
- **Voice entry** that parses a spoken transaction and asks you to confirm
  before saving — never a silent write.
- **Works without an account**: "Use without an account" keeps the whole ledger
  in the phone's own storage (IndexedDB) and needs no network at all, ever.
- **Optional cloud account** (Supabase) for a server-side copy shared across
  devices. Signing in and reading an account's ledger needs a connection —
  see [Offline behaviour](#offline-behaviour) for exactly what works when.
- **Bilingual** Bangla / English, light & dark themes, optional Bengali numerals.

### Balances are derived, never edited

A party's balance is always computed from its opening balance plus its
transaction history. There is no editable "balance" field to tamper with, so the
ledger always reconciles with reality.

---

## Tech stack

| Area        | Choice                                                |
| ----------- | ----------------------------------------------------- |
| UI          | React 18 + TypeScript 5 (strict)                      |
| Build       | Vite 5                                                |
| Styling     | Tailwind CSS 3                                         |
| Routing     | React Router 6                                         |
| Backend     | Supabase (Postgres + Auth) — optional                 |
| Offline     | IndexedDB via a local data adapter                    |
| PWA         | vite-plugin-pwa (Workbox service worker)              |
| Icons       | lucide-react                                           |

The app talks to a single `DataAdapter` interface. In mock mode that's the
on-device store; with Supabase configured it's the live backend. No screen code
changes between the two.

---

## Requirements

- **Node.js 20 LTS** recommended (18+ required by Vite 5).
- npm 9+ (bundled with Node).

---

## Quick start (offline / mock mode)

No backend needed — the app runs entirely on-device.

```bash
npm install
cp .env.example .env   # defaults to VITE_DATA_BACKEND=mock
npm run dev
```

Open the printed URL (default `http://localhost:5173`). Pick **Use without an
account** to go straight in (no auth server involved), or create an account —
in mock mode auth is local. Complete the one-screen business setup and start
adding entries. The app **starts empty** — real data you enter persists in the
browser. If you want to explore with sample data, use
**Settings → Demo data** (shown only in mock mode).

### Scripts

| Command             | What it does                                  |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Start the Vite dev server with hot reload     |
| `npm run build`     | Type-check (`tsc -b`) then build for production |
| `npm run preview`   | Serve the production build locally            |
| `npm run typecheck` | Type-check only, no output                    |

---

## Configuration

All configuration is via `.env` (Vite exposes only `VITE_*` variables to the
client). Copy `.env.example` to `.env` and edit.

| Variable                  | Required        | Default | Notes                                             |
| ------------------------- | --------------- | ------- | ------------------------------------------------- |
| `VITE_DATA_BACKEND`       | no              | `mock`  | `mock` (on-device) or `supabase` (live)           |
| `VITE_SUPABASE_URL`       | for Supabase    | —       | Project URL, Settings → API                       |
| `VITE_SUPABASE_ANON_KEY`  | for Supabase    | —       | **Public anon key only** — never the service key  |
| `VITE_ENABLE_GOOGLE_AUTH` | no              | `false` | Show the Google sign-in button                    |
| `VITE_DEFAULT_LANG`       | no              | `bn`    | `bn` or `en`                                      |
| `VITE_DEFAULT_CURRENCY`   | no              | `৳`     | Currency symbol shown in the UI                   |
| `VITE_PUBLIC_URL`         | for the APK     | —       | Deployed site URL, used for auth email links      |

The app only switches to the live backend when **all three** of
`VITE_DATA_BACKEND=supabase`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY`
are set. Otherwise it falls back to the on-device store.

> **Security:** only the public **anon** key belongs in a frontend. Never put a
> Supabase service-role key in `.env` or any client code — it bypasses Row-Level
> Security. `.env` is git-ignored; keep it that way.

---

## Running with Supabase (cloud account)

1. **Create a project** at [supabase.com](https://supabase.com). Wait for the
   database to finish provisioning.

2. **Apply the schema.** In the dashboard open **SQL Editor** and run the two
   migration files in order:
   - `supabase/migrations/0001_init.sql` — tables, indexes, triggers
   - `supabase/migrations/0002_rls.sql` — Row-Level Security policies

   Or, with the [Supabase CLI](https://supabase.com/docs/guides/cli):

   ```bash
   supabase link --project-ref <your-ref>
   supabase db push
   ```

3. **Get your keys** from **Settings → API**: the Project URL and the `anon`
   public key.

4. **Configure `.env`:**

   ```env
   VITE_DATA_BACKEND=supabase
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
   ```

5. **Enable auth providers** under **Authentication → Providers**. Email is on by
   default. For Google sign-in, configure the Google provider, then set
   `VITE_ENABLE_GOOGLE_AUTH=true`. Add your dev and production URLs to
   **Authentication → URL Configuration**.

6. Restart `npm run dev`. New sign-ups automatically get a profile row, and every
   query is scoped to the signed-in user's business by RLS.

### Security model

Row-Level Security is enforced on every table. A user can read or write a
business's rows only if they are a member of that business
(`business_members`); the owner is added as a member at signup. Membership is
resolved through a `SECURITY DEFINER` helper (`is_member_of`) so the policy check
never recurses. Transaction, expense, and reminder inserts must be attributed to
the acting user (`created_by = auth.uid()`), and amounts are constrained to be
positive at the database level.

---

## Offline behaviour

There are two session types, and they behave very differently without a network.
This section is deliberately blunt: a shopkeeper who believes a write was saved
when it was not would lose real money.

**No account (on-device session)** — chosen with "Use without an account" on the
sign-in screen, and the only mode available when no Supabase env is configured.
Reads and writes go straight to IndexedDB on the phone. Everything works with
the network switched off, permanently. The sync pill shows a neutral phone icon,
not a tick, because nothing is being uploaded. There is no server copy, so the
JSON backup in Settings is the only way to move or protect this data.

**Cloud account session** — reads and writes go to Supabase over the network.
Sign-in, sign-up, password reset, and loading a business all require a
connection; each returns a plain "no internet connection" message when there
isn't one, and the app never pretends a write was queued. If the first load
fails, you get a retry screen (`DataUnavailable`) that also offers to continue
on-device — it does **not** send you to onboarding, which would create a second
shop over the first. The load retries itself automatically when the connection
comes back.

There is intentionally **no write outbox in cloud mode**: `SupabaseAdapter`
writes are online and transactional. Offline capture is the job of the
on-device session above.

### Installability

- The service worker (autoUpdate) precaches the app shell, so it launches
  offline and updates itself in the background.
- On phones, "Add to Home Screen" installs HisabMate as a standalone app.
- `public/offline.html` is a friendly branded fallback if a navigation ever
  fails while offline.

### App icons

Icons are shipped as SVG (`public/favicon.svg` and `public/icons/maskable.svg`),
which render crisply at every launcher size and are installable on modern
Android, Chrome, and desktop.

**Optional — add raster PNGs** for the nicest iOS home-screen icon and a perfect
Lighthouse PWA score. Generate them from the SVG with any rasterizer, e.g.:

```bash
# using librsvg
rsvg-convert -w 192 -h 192 public/favicon.svg          -o public/icons/icon-192.png
rsvg-convert -w 512 -h 512 public/favicon.svg          -o public/icons/icon-512.png
rsvg-convert -w 512 -h 512 public/icons/maskable.svg   -o public/icons/maskable-512.png
rsvg-convert -w 180 -h 180 public/favicon.svg          -o public/icons/apple-touch-icon.png
```

Then list those PNGs in the `manifest.icons` array in `vite.config.ts` and point
the `apple-touch-icon` link in `index.html` at
`/icons/apple-touch-icon.png`.

### Native Android app

Beyond "Add to Home Screen", the same web bundle ships as a real installable
Android app through [Capacitor](https://capacitorjs.com). `capacitor.config.ts`
holds the app identity (`com.hisabmate.app`, splash and status-bar colours) and
`src/lib/native.ts` holds everything that only applies on a device: hardware
back-button handling, status-bar tinting that follows the resolved theme, and
hiding the launch splash after first paint. All of it is a no-op in a browser,
so nothing about the web build changes.

`android/` is generated by `npx cap add android`, not committed. You can build
the APK two ways:

- **In the cloud, nothing installed locally** — `.github/workflows/android.yml`
  (Actions → "Android APK" → Run workflow) builds it on GitHub's runners and
  attaches `app-debug.apk` as an artifact. It refuses to run without the
  Supabase secrets rather than shipping an APK on demo data.
- **On your own machine**, if you have Android Studio: `npm run app:add` once,
  then `npm run app:icons` and `npm run app:apk`.

Step-by-step instructions in Bangla, including the secrets to set and the
Supabase redirect URLs the app needs, are in **[ANDROID_APP.md](ANDROID_APP.md)**.

---

## Project structure

```
hisabmate/
├─ public/                 # favicon.svg, offline.html, icons/
├─ assets/                 # logo.svg — source art for native icon + splash
├─ .github/workflows/      # android.yml — cloud APK build
├─ src/
│  ├─ components/          # UI primitives + app shell (layout/)
│  ├─ contexts/            # Theme, I18n, Settings, Toast, Auth, Data, Sync
│  ├─ features/            # parties, transactions, expenses, products, voice, quick-actions
│  ├─ pages/               # route screens (auth/ holds Login, Signup, Onboarding)
│  ├─ routes/              # RequireAuth / RequireBusiness route guards
│  ├─ services/            # data adapters (local + supabase), ledger engine, inventory, seed
│  ├─ lib/                 # env, supabase client, native (Capacitor) helpers
│  ├─ i18n/                # en / bn dictionaries
│  ├─ types/               # domain model
│  ├─ utils/               # date, money, id, cn helpers
│  ├─ App.tsx              # provider stack + route tree
│  └─ main.tsx             # entry
├─ supabase/migrations/    # 0001_init.sql, 0002_rls.sql, 0003_inventory.sql
├─ capacitor.config.ts     # native app identity (android/ is generated)
├─ ANDROID_APP.md          # Bangla APK guide
├─ .env.example
└─ vite.config.ts
```

---

## License

Provided as-is for the project owner. HisabMate is original work; its name,
visual identity, and code are not affiliated with any other khata or ledger
product.
