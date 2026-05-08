# Bond Calculator (Mockup)

A static web mockup for demonstrating bond coupon and principal repayment
schedules. Staff pick a bond, enter customer details, and print a schedule.
Admins manage the bond catalogue on a separate URL.

**Fully static** — no backend, no database, no environment variables.
All data lives in the browser's `localStorage` on each device.

## Deploy

Drop this folder on Vercel (or any static host) — no build step required.
Vercel auto-detects it as a static site.

## URLs

| URL       | Audience | Purpose                          |
|-----------|----------|----------------------------------|
| `/`       | Staff    | Calculator + schedule viewer     |
| `/admin`  | Admins   | Login + bond management          |

## Admin login

- **Username:** `keovoin`
- **Password:** `admin`

On first sign-in a yellow banner prompts the admin to change the password.
After that, the banner disappears and the new password is stored (hashed
with SHA-256) in the browser's `localStorage`.

## Features

- Multi-bond catalogue — unlimited bonds, each with its own issuer, currency,
  unit price, coupon rate, tenor, WHT rates, min investment and amortization
  schedule.
- Staff-facing calculator with bond picker and two-way amount/units sync.
- Monthly schedule with daily-accrued coupon interest, annual principal
  amortization, WHT per payment, default-rate reference.
- Print-ready layout and CSV export.
- Fully mobile responsive, animated UI, respects `prefers-reduced-motion`.

## Notes on storage

- Bond data is stored per browser / device under `localStorage` key
  `bc.bonds`. Refreshing or re-opening the site keeps the data.
- The first visit seeds one sample bond so you can calculate immediately.
- Admin panel includes a "Reset all data" button that clears bonds +
  password on that device.
- Since there is no server, different devices have independent data.
  Good enough for a mockup; for production, re-introduce a backend.
