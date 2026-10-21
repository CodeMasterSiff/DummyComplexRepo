# MediBook

Patient booking for Northside Health Centre.

## Dev

    npm install
    npm run dev:server   # API on :4000
    npm run dev:web      # web on :5173

Demo logins are in `server/src/db/seed.ts`. Data is in memory and resets on restart.

Env flags (server):

- `LEGACY_STRIKES=1` – old no-show rules
- `WAITLIST=0` – turn off the waitlist
- `NO_JOBS=1` – don't start background jobs

Slots are held for 15 min while the patient finishes booking.
