# AGENTS.md

## Cursor Cloud specific instructions

### What this is
BAHMAL CRM — a Russian-language, Firebase-backed React 19 + TypeScript + Vite single-page app (internal role-based CRM: leads/clients, tasks, KPI, SMM, projects, AI lead analysis). Package manager is npm.

### Services / packages
- Root app (`/`): the Vite SPA. This is the product.
- `functions/`: Firebase Cloud Functions (secondary/alternate backend). It has its own `package.json` + lockfile, so install it separately.
- `api/`: Vercel serverless functions (`/api/*`). This is the backend the SPA actually calls (see `src/firebase/callable.ts`). They share the root `package.json` deps (no separate install).

### Standard commands (see root `package.json` scripts)
- Dev server: `npm run dev` (Vite, http://localhost:5173).
- Build: `npm run build` (`tsc -b && vite build`).
- Lint: `npm run lint` (oxlint; currently emits a few warnings, exits 0).
- There are **no automated tests** and no CI config in this repo.

### Firebase config is required to actually use the app (non-obvious)
The app connects to a **live Firebase project** (Firestore + Auth Email/Password + Storage). There is no emulator wiring in the committed code and no `emulators` block in `firebase.json`.
- `src/firebase/config.ts` reads `VITE_FIREBASE_*` from a `.env.local` (gitignored). Without it, `getAuth()` throws `auth/invalid-api-key` at startup and only the login page renders (login fails). Build/lint do **not** need these vars.
- The Vite dev server must be **restarted** to pick up `.env.local` changes (env is inlined at server start).
- `/api/*` admin & AI endpoints additionally need `FIREBASE_SERVICE_ACCOUNT_JSON` (and `GROQ_API_KEY` for AI). They only run under `vercel dev` (or on Vercel), not under plain `npm run dev`. Core CRM (login, leads, tasks) does not need `/api`.

### Running end-to-end offline (no real Firebase project)
For local E2E without production secrets, use the Firebase Emulator Suite (`firebase-tools` is a dev dep; Java is present). This requires **temporary, uncommitted** changes:
1. Add `connectAuthEmulator`/`connectFirestoreEmulator`/`connectStorageEmulator` calls in `src/firebase/config.ts` (guard behind an env flag).
2. Create `.env.local` with a `demo-*` project id and dummy `VITE_FIREBASE_*` values.
3. Start emulators with a temporary config exposing an `emulators` block (auth :9099, firestore :8080, storage :9199), e.g. `npx firebase emulators:start --project demo-<name> --only auth,firestore,storage`.
4. Seed an admin: create an Auth user + a `users/{uid}` doc with `role: 'admin'` (firebase-admin auto-targets emulators via `FIREBASE_AUTH_EMULATOR_HOST`/`FIRESTORE_EMULATOR_HOST`). Firestore security rules (`firestore.rules`) still apply, so the profile must have `role: 'admin'` for full access.
Revert all of the above before committing.
