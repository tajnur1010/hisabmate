# HisabMate

**A premium digital khata (business ledger) for small shops — offline-first, Bangla + English.**

HisabMate helps a shopkeeper track customers and suppliers, record credit and
payments, log expenses, and see exactly who owes what — on a phone, even with no
internet. It is a mobile-first Progressive Web App: install it to the home
screen and it behaves like a native app.

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
- **Offline-first**: data is stored on-device (IndexedDB) and works with no
  network. Optional Supabase backend adds cloud sync across devices.
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

Open the printed URL (default `http://localhost:5173`). Create an account (in
mock mode auth is local), complete the one-screen business setup, and start
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

The app only switches to the live backend when **all three** of
`VITE_DATA_BACKEND=supabase`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY`
are set. Otherwise it falls back to the on-device store.

> **Security:** only the public **anon** key belongs in a frontend. Never put a
> Supabase service-role key in `.env` or any client code — it bypasses Row-Level
> Security. `.env` is git-ignored; keep it that way.

---

## Running with Supabase (cloud sync)

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

## Offline & installability

- The service worker (autoUpdate) precaches the app shell, so it launches
  offline and updates itself in the background.
- On phones, "Add to Home Screen" installs HisabMate as a standalone app.
- Writes made offline are kept on-device and reconciled when you reconnect
  (in Supabase mode).
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

---

## Project structure

```
hisabmate/
├─ public/                 # favicon.svg, offline.html, icons/
├─ src/
│  ├─ components/          # UI primitives + app shell (layout/)
│  ├─ contexts/            # Theme, I18n, Settings, Toast, Auth, Data, Sync
│  ├─ features/            # parties, transactions, expenses, voice, quick-actions
│  ├─ pages/               # route screens (auth/ holds Login, Signup, Onboarding)
│  ├─ routes/              # RequireAuth / RequireBusiness route guards
│  ├─ services/            # data adapters (local + supabase), ledger engine, seed
│  ├─ lib/                 # env + supabase client
│  ├─ i18n/                # en / bn dictionaries
│  ├─ types/               # domain model
│  ├─ utils/               # date, money, id, cn helpers
│  ├─ App.tsx              # provider stack + route tree
│  └─ main.tsx             # entry
├─ supabase/migrations/    # 0001_init.sql, 0002_rls.sql
├─ .env.example
└─ vite.config.ts
```

---

## License

Provided as-is for the project owner. HisabMate is original work; its name,
visual identity, and code are not affiliated with any other khata or ledger
product.
