# Bond Calculator

A serverless web application for generating bond coupon and principal repayment
schedules. Staff pick a bond, enter the customer details, and print or export
the schedule. Admins manage the bond catalogue on a separate URL.

Runs on **Vercel** with a **Turso** (libSQL over HTTP) database.

---

## Live URLs

| URL            | Audience  | Purpose                                 |
|----------------|-----------|-----------------------------------------|
| `/`            | Staff     | Pick bond, enter customer, get schedule |
| `/admin`       | Admins    | Login + bond management                 |
| `/admin/setup` | First run | Create the initial admin (one time)     |

---

## One-time deployment on Vercel

### 1. Create a Turso database (free)

```bash
# Install Turso CLI once, then:
turso auth signup         # or: turso auth login
turso db create bond-calc
turso db show bond-calc --url          # <-- copy this
turso db tokens create bond-calc       # <-- copy this
```

Keep the two values handy — you'll paste them into Vercel in a moment.

### 3. Add environment variables on Vercel

**Vercel dashboard → your project → Settings → Environment Variables**

Required:

| Name | Value |
|------|-------|
| `TURSO_DATABASE_URL` | The `libsql://...` URL from step 2 |
| `TURSO_AUTH_TOKEN` | The token from step 2 |
| `JWT_SECRET` | Any 32+ random characters (see below) |
| `NODE_ENV` | `production` |

Optional — **skip the `/admin/setup` step by auto-seeding an admin account**:

| Name | Value |
|------|-------|
| `SEED_ADMIN_USERNAME` | e.g. `keovoin` |
| `SEED_ADMIN_PASSWORD` | e.g. `admin` (choose any) |

If both seed variables are set **and** no admin exists yet, the first
visit to any API endpoint creates that admin automatically. The admin is
flagged as "must change password" — the panel shows a prominent yellow
warning banner and jumps straight to the password-change form at next login.
Once you change the password, the warning disappears and the seed variables
become no-ops.

Generate a strong `JWT_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Redeploy

Push the branch or hit "Redeploy" in the Vercel dashboard.

### 5. First-time admin setup

Two options:

- **With seed vars set:** go directly to `https://YOUR-APP.vercel.app/admin`
  and sign in with `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD`. You'll be
  prompted to change the password immediately.
- **Without seed vars:** visit `https://YOUR-APP.vercel.app/admin/setup`
  and create your account. That URL becomes inaccessible after the first
  account exists.

---

## Local development

```bash
npm install
npm install -g vercel      # once
vercel link                # link to your Vercel project
vercel env pull .env.local # pull env vars down
npm run dev                # runs `vercel dev`
```

Open `http://localhost:3000`.

---

## Features

- **Multi-bond catalogue** — any number of bonds, each with its own issuer,
  currency, unit price, coupon rate, tenor, WHT rates, min investment and
  amortization schedule.
- **Daily interest accrual + monthly payments** — no holiday adjustment.
- **Annual straight-line principal amortization** via "percent of remaining"
  schedule. The default `[20, 25, 33.33, 50, 100]` repays 20% of original
  each year.
- **Withholding tax** applied per coupon (6% resident / 14% non-resident by
  default, both editable per bond).
- **Default-rate reference** shown on the schedule (coupon + spread, e.g.
  10.5% p.a.) for staff to apply manually to late coupons.
- **Print / Save PDF** and **CSV export** from the schedule view.
- **Mobile-responsive**, animated UI, printable styles.

## Security

- First-time setup page is automatically disabled after one admin exists.
- No default password — admins choose their own.
- Passwords hashed with bcrypt (cost 10).
- Auth is a signed JWT in an httpOnly cookie (stateless, 8h expiry).
- Timing-safe login: bcrypt compare runs even for nonexistent users.

## Project structure

```
/api/                     Serverless functions (one file per route)
  bonds.js                GET active bonds
  calculate.js            POST build a schedule
  admin/
    login.js              POST sign in
    logout.js             POST sign out
    session.js            GET current session
    setup.js              POST create first admin
    setup-status.js       GET whether setup is needed
    password.js           POST change password
    bonds.js              GET/POST admin bond CRUD
    bonds/[id].js         GET/PUT/DELETE a specific bond
/lib/                     Shared modules
  auth.js                 JWT + cookie helpers
  calc.js                 Schedule calculation engine
  db.js                   Turso/libSQL access
  bondValidation.js       Bond payload sanitisation
  util.js                 Request helpers
/public/                  Static assets served by Vercel
  index.html              Staff calculator
  admin.html              Admin panel
  setup.html              First-run setup page
  assets/                 CSS + JS
vercel.json               Rewrites for /admin, /admin/setup
```
