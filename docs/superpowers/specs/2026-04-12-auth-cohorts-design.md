# Spec #4 — Auth + Cohorts

**Date:** 2026-04-12
**Status:** Design approved, awaiting implementation plan
**Depends on:** Specs #1–3 (content model, lesson runtime, code execution — all merged to `master` at `f9018f8`)
**Successor specs:** #5 (submission persistence + grading), #8 (instructor dashboard)

## Goal

Add user accounts, login (email+password and Google OAuth), JWT-based sessions, role-based access control, and wire the existing Settings menu's "Sign in" button into a real auth flow. Protect `POST /api/run` so only authenticated users can execute code. Lay the Passport.js strategy-pattern foundation so Microsoft and GitHub OAuth can be added later with minimal effort.

## Non-goals

- Instructor dashboard / cohort management UI (spec #8)
- Password reset / forgot password flow (follow-up)
- Microsoft OAuth + GitHub OAuth (future — architecture ready, just not wired yet)
- Email verification (overkill for internal bootcamp)
- Rate limiting on login attempts (follow-up security pass)
- Admin user management UI (spec #8 or standalone)
- Persisting attempts or showing progress per student (spec #5)

## Data model

### New: `User` entity

```prisma
enum UserRole {
  student
  instructor
  admin
}

model User {
  id            String    @id @db.Uuid
  email         String    @unique
  name          String
  passwordHash  String?          // null for OAuth-only users
  role          UserRole  @default(student)
  googleId      String?   @unique // for Google SSO; null for password-only users
  createdAt     DateTime  @default(now())
  student       Student?          // 1:1 — exists only once enrolled
}
```

### Modified: `Student` entity

Add a `userId` FK linking Student to User:

```prisma
model Student {
  id        String   @id @db.Uuid
  userId    String   @unique @db.Uuid    // NEW — FK to User
  user      User     @relation(fields: [userId], references: [id])
  name      String
  email     String   @unique
  cohortId  String?  @db.Uuid
  createdAt DateTime @default(now())
  // ... existing relations stay
}
```

`Student.name` and `Student.email` are denormalized from `User` for backward compatibility with specs #1–3 (existing code references `Student.email`, `Student.name`). Future specs can migrate to reading from `User`.

The `Student` record is created when a User enrolls in a track (spec #5 or later). For spec #4, registration creates a `User` only — no `Student` record until enrollment. Existing seed Student data is unaffected (the migration adds `userId` as nullable first, then backfills, then makes it required — or we just make it optional for now and require it in spec #5).

**Decision: `userId` is optional (`String?`) in spec #4.** Making it required would force a backfill migration for existing Student rows that have no User. Since spec #4 doesn't touch enrollment, we defer the required constraint to spec #5 when enrollment wires User → Student.

## Architecture

### New backend module

```
platform/src/
  auth/
    auth.module.ts
    auth.controller.ts              (register, login, logout, refresh, me, google, google/callback)
    auth.service.ts                 (register, login, validateUser, refreshTokens, findOrCreateGoogleUser)
    strategies/
      local.strategy.ts             (Passport email+password)
      google.strategy.ts            (Passport Google OAuth 2.0)
      jwt.strategy.ts               (Passport JWT — reads from cookie)
    guards/
      jwt-auth.guard.ts             (@UseGuards for protected routes)
      roles.guard.ts                (role-based access via @Roles decorator)
    decorators/
      current-user.decorator.ts     (@CurrentUser() extracts user from request)
      roles.decorator.ts            (@Roles('instructor') sets metadata)
    user.repository.ts              (Prisma CRUD for User)
```

### Dependencies

```
@nestjs/passport  passport  passport-local  passport-google-oauth20  passport-jwt
bcryptjs  @types/bcryptjs
cookie-parser  @types/cookie-parser
```

### Token flow

```
Register or Login
  → AuthService hashes/verifies password (bcrypt, cost 10)
  → Issues accessToken (JWT, 15min TTL, signed with JWT_SECRET)
  → Issues refreshToken (JWT, 7 day TTL, signed with JWT_REFRESH_SECRET)
  → Both set as httpOnly cookies:
      bc.access  — maxAge 15min, httpOnly, secure in prod, sameSite lax, path /
      bc.refresh — maxAge 7 days, httpOnly, secure in prod, sameSite lax, path /api/auth/refresh
  → Response body: { user: UserResponse }

Every authenticated request
  → JwtAuthGuard reads bc.access cookie
  → passport-jwt extracts + validates the JWT
  → Injects { userId, email, role } into request.user

Token refresh
  → POST /api/auth/refresh
  → Reads bc.refresh cookie, validates
  → Issues new bc.access cookie
  → 200 { user }

Logout
  → POST /api/auth/logout
  → Clears bc.access + bc.refresh cookies
  → 200 {}
```

### Google OAuth flow

```
Browser clicks "Sign in with Google"
  → navigates to /api/auth/google
  → NestJS redirects to Google consent screen (passport-google-oauth20)
  → User approves
  → Google redirects to /api/auth/google/callback with auth code
  → GoogleStrategy exchanges code for profile
  → AuthService.findOrCreateGoogleUser(profile):
      - If User with this googleId exists → return it
      - If User with this email exists but no googleId → link (set googleId) → return it
      - Otherwise → create new User with googleId, no passwordHash → return it
  → AuthService issues JWT pair as cookies
  → Redirect to FRONTEND_URL (http://localhost:3001)
```

No OAuth tokens are stored long-term. Google is used only at login time for identity verification. The platform's own JWT is the session token afterwards.

### Cookie configuration

```ts
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

// access cookie: maxAge = 15 * 60 * 1000
// refresh cookie: maxAge = 7 * 24 * 60 * 60 * 1000, path = '/api/auth/refresh'
```

## API contract

| Route | Method | Auth | Body | Response |
|---|---|---|---|---|
| `/api/auth/register` | POST | public | `{email, name, password}` | 201 `{user}` + cookies |
| `/api/auth/login` | POST | public | `{email, password}` | 200 `{user}` + cookies |
| `/api/auth/logout` | POST | any | — | 200 `{}` + clear cookies |
| `/api/auth/refresh` | POST | public (refresh cookie) | — | 200 `{user}` + new access cookie |
| `/api/auth/me` | GET | required | — | 200 `{user}` or 401 |
| `/api/auth/google` | GET | public | — | 302 → Google |
| `/api/auth/google/callback` | GET | public | — | 302 → frontend + cookies |

### UserResponse shape

```ts
type UserResponse = {
  id: string;
  email: string;
  name: string;
  role: 'student' | 'instructor' | 'admin';
  googleId: string | null;
  createdAt: string;
};
```

### Error responses

| Scenario | Status | Body |
|---|---|---|
| Duplicate email on register | 409 | `{error: 'email_taken'}` |
| Invalid credentials on login | 401 | `{error: 'invalid_credentials'}` |
| Email domain not allowed | 403 | `{error: 'email_domain_not_allowed'}` |
| Missing/expired access token | 401 | `{error: 'unauthorized'}` |
| Insufficient role | 403 | `{error: 'forbidden'}` |
| Invalid refresh token | 401 | `{error: 'invalid_refresh_token'}` |

### Validation rules

- `email`: valid email format (`@IsEmail()`), unique. If `ALLOWED_EMAIL_DOMAIN` env is set, the domain portion must match.
- `password`: minimum 8 characters (`@MinLength(8)`). Hashed with bcrypt cost 10.
- `name`: non-empty string (`@MinLength(1)`).
- Google login with an email that already has a password account: **links** the Google identity (sets `googleId` on the existing User). No duplicate accounts.

## Route protection

Spec #4 protects one existing endpoint:

- `POST /api/run` → `@UseGuards(JwtAuthGuard)`. Returns 401 without a valid access token. The web UI should show a "Sign in to run code" message when the user is not authenticated and clicks Run, rather than showing a raw 401 error.

All other routes stay public:
- `GET /api/lessons/:id` — public (auth-optional; spec #5 may add progress data if authenticated)
- All content read endpoints — public

## Environment variables (new)

```env
JWT_SECRET=<random 32+ char string>
JWT_REFRESH_SECRET=<different random string>
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
FRONTEND_URL=http://localhost:3001
ALLOWED_EMAIL_DOMAIN=              # optional — blank means open registration
```

Added to `.env.template`. For local dev without Google OAuth, `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` can be left empty — the Google strategy simply won't register, and the "Sign in with Google" button shows as disabled in the UI.

## Web UI

### New pages

**`/login`** — centered card with:
- Email + password form
- "Sign in" submit button
- "Sign in with Google" button (disabled if Google OAuth not configured — detected via a new `GET /api/auth/providers` endpoint that returns `{google: boolean}`)
- Link to `/register`
- Inline error messages for invalid credentials, etc.

**`/register`** — centered card with:
- Email + name + password form
- "Create account" submit button
- "Sign up with Google" button (same availability check)
- Link to `/login`
- Inline error messages for duplicate email, domain restriction, etc.

Both are client components (form state). On success, redirect to `/`.

### New endpoint: `GET /api/auth/providers`

Returns `{ google: boolean }` — true if `GOOGLE_CLIENT_ID` is configured. The web app calls this once on mount to decide whether to show the Google button. No auth required.

### Modified: SettingsMenu

- **Logged out:** "Sign in" button navigates to `/login` (no longer disabled).
- **Logged in:** shows user avatar circle (first letter of name), full name, email, role badge. "Sign out" button calls `POST /api/auth/logout`, clears local state, redirects to `/login`.

### Auth context

New `components/layout/AuthProvider.tsx` — client component wrapping the app:
- On mount: calls `GET /api/auth/me` (with credentials). If 200, stores user in context. If 401, user is null.
- Exposes `{user, loading, login, register, logout}` via React context.
- `useAuth()` hook for any component that needs the current user.

New `lib/auth.ts`:
```ts
export async function fetchMe(): Promise<UserResponse | null>
export async function login(email: string, password: string): Promise<UserResponse>
export async function register(email: string, name: string, password: string): Promise<UserResponse>
export async function logout(): Promise<void>
export function googleLoginUrl(): string   // returns /api/auth/google
```

All functions use `credentials: 'include'` for cookie transport.

### Modified: CodeExercise + FixBugExercise

When Run is clicked and the user is not authenticated (`useAuth().user === null`):
- Don't call `/api/run`.
- Instead show a message: "Sign in to run code" with a link to `/login`.

When Run returns 401 (session expired mid-session):
- Show "Session expired — please sign in again" in the RunResult panel with a link to `/login`.

### New web files

```
web/
  app/login/page.tsx
  app/register/page.tsx
  lib/auth.ts
  components/layout/AuthProvider.tsx
  components/layout/SettingsMenu.tsx  (modified)
  components/lesson/renderers/CodeExercise.tsx  (modified — auth check before run)
  components/lesson/renderers/FixBugExercise.tsx  (modified — same)
  app/layout.tsx  (modified — wrap with AuthProvider)
```

## Testing

| Layer | Tool | Coverage |
|---|---|---|
| `UserRepository` | Jest | CRUD: create, findByEmail, findByGoogleId, update googleId |
| `AuthService` register | Jest | Creates user with hashed password, rejects duplicate email, enforces domain restriction |
| `AuthService` login | Jest | Returns user on correct password, rejects wrong password, rejects non-existent email |
| `AuthService` tokens | Jest | Issues valid JWT pair, refresh with valid token returns new access, refresh with expired/invalid token throws |
| `AuthService` Google | Jest | Creates new user on first Google login, links existing user by email, returns existing user by googleId |
| `AuthController` HTTP | Jest + supertest | Register 201 + cookies, login 200 + cookies, login 401 bad password, register 409 duplicate, /me 200 authed / 401 not, /logout clears cookies, /refresh issues new access cookie, /providers returns `{google: bool}` |
| `JwtAuthGuard` | Jest | Rejects missing token (401), rejects expired token (401), passes valid token, injects user |
| `RolesGuard` | Jest | Rejects insufficient role (403), allows matching role |
| `POST /api/run` protected | Jest + supertest | Returns 401 without token, 200 with valid token (DockerRunner mocked) |
| Web `lib/auth.ts` | Vitest | Mocked fetch: login, register, me, logout, error handling |
| Login page | Vitest + RTL | Renders form, submits, shows error on 401, redirects on success |
| Register page | Vitest + RTL | Renders form, submits, shows error on 409, redirects on success |
| AuthProvider + SettingsMenu | Vitest + RTL | Shows "Sign in" logged out, shows name + "Sign out" logged in |
| CodeExercise auth check | Vitest + RTL | Shows "Sign in to run code" when no auth, calls runExercise when authed |
| Playwright | Playwright | Register → see lesson → sign out → Run blocked → log back in → Run works |

## Success criteria

1. New user registers at `/register` with email+password → redirected to lesson page → name visible in Settings menu.
2. User logs out → clicks Run → sees "Sign in to run code" message (not a raw 401).
3. User logs back in at `/login` → clicks Run → code executes normally.
4. User clicks "Sign in with Google" → completes Google OAuth → redirected to lesson with valid session.
5. Google login with an email matching an existing password account → links identities, no duplicate.
6. With `ALLOWED_EMAIL_DOMAIN=example.com`, registration with `@other.com` rejected with clear error.
7. Expired access token (15 min) transparently refreshed via refresh endpoint — user never sees a login prompt during a study session.
8. `POST /api/run` returns 401 without a valid token.
9. All Jest, Vitest, and Playwright suites pass.

## Architectural decisions

1. **JWT in httpOnly cookies, not localStorage.** XSS-safe. Server Components can read cookies during SSR if needed in future specs. `sameSite: 'lax'` prevents CSRF on non-GET requests while allowing Google OAuth redirects.
2. **Separate User and Student entities.** User is auth identity; Student is enrollment/progress. A user doesn't become a Student until they enroll (spec #5+). This avoids coupling auth to the learning data model.
3. **`Student.userId` is optional in spec #4.** Existing Student rows from the seed have no User. Making `userId` required would need a migration backfill. Defer to spec #5 when enrollment wires User → Student.
4. **Passport.js strategy pattern.** Each auth method is a self-contained strategy file. Adding Microsoft or GitHub later is one new file + one line in the module. No refactoring needed.
5. **Google OAuth does not store Google tokens.** Used only at login for identity verification. The platform's own JWT is the session after that. Simpler, no token refresh complexity for Google.
6. **`/api/auth/providers` endpoint.** Lets the frontend disable the Google button when credentials aren't configured, without hardcoding env checks in the web build.
7. **Graceful degradation without Google credentials.** If `GOOGLE_CLIENT_ID` is empty, the Google Passport strategy simply doesn't register. The platform works fine with email+password only. This means dev setup doesn't require a Google Cloud project.
