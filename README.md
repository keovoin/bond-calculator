# Bond Calculator

A web application for generating bond coupon and principal repayment schedules.
Staff use the main page to pick a bond, enter customer details, and print a
schedule. Administrators use a separate URL to manage the list of bonds.

## Features

- **Multi-bond catalogue** — admins can configure as many bond offerings as needed
  (different issuers, currencies, tenors, coupon rates, amortization schedules,
  minimum investments and unit prices).
- **Staff calculator** — pick a bond, enter customer info and amount, get a
  full monthly schedule with daily-accrued interest, annual principal
  amortization, withholding-tax handling and a print/CSV-ready view.
- **Separate admin URL** — `/admin` is isolated from the staff UI.
- **Secure first-time setup** — no default password is ever shown. On first use
  the site redirects to `/admin/setup` so the first admin can pick their own
  username and password. Setup becomes permanently unavailable after the first
  account exists.
- **Session-based auth** with bcrypt-hashed passwords and HTTP-only cookies.
- **Responsive, modern UI** with subtle animations (respects
  `prefers-reduced-motion`).

## Running locally

```bash
npm install
npm start
```

The server listens on `http://localhost:3000`. On first launch visit
`/admin/setup` to create your administrator account, then go to `/admin` to
add bonds.

## Environment

- `PORT` (default `3000`)
- `SESSION_SECRET` (auto-generated on startup if not supplied; set it explicitly
  in production so sessions survive restarts)
- `NODE_ENV=production` enables secure cookies (requires HTTPS)

## URL map

| URL              | Who        | Purpose                                      |
|------------------|------------|----------------------------------------------|
| `/`              | Staff      | Customer-facing calculator & schedule viewer |
| `/admin`         | Admins     | Login + bond management                      |
| `/admin/setup`   | First run  | Create the initial admin account             |
| `/api/bonds`     | Public     | List active bonds                            |
| `/api/calculate` | Public     | Generate a schedule                          |
| `/api/admin/*`   | Authed     | Admin CRUD endpoints                         |

## Calculation rules

- Coupon interest: `outstanding × rate × days / day_count` per monthly period,
  accrued daily.
- Coupon payment dates: same day-of-month as issue date, no holiday
  adjustment.
- Principal repayment: on each anniversary of the issue date, a configurable
  percentage of the *remaining* principal is repaid. The default
  `[20, 25, 33.33, 50, 100]` produces straight-line amortization (each year
  repays 20% of original principal).
- WHT: resident or non-resident percentage applied to each coupon.
- Default (penalty) rate: `coupon_rate + default_spread`. Shown on the
  schedule for reference; applied manually case-by-case for late payments.

## Data

SQLite database file lives at `bond-calculator/db/bonds.db` (gitignored).
Back it up to preserve your bond configuration and admin account.
