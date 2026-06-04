# Invite-Only Access — Design Spec

**Date:** 2026-06-04
**Status:** Approved (design), ready for implementation plan
**Area:** `platform/` auth + `web/` (two-repo)

## Problem

BootCamp currently allows open self-registration: anyone can `POST /api/auth/register`,
and any Google account auto-provisions a user. We need invite-only access:

- A **master admin** (promoted from an existing user) invites **instructors** by email.
- Each invite produces a **copyable card** containing a magic link, which the inviter
  pastes into their own email client and sends manually (no SMTP/email provider).
- The invitee opens the link, **sets a password**, and their account becomes valid.
- An **instructor** can do the same for **students**; an invited student is
  **automatically linked to that instructor**.
- Admins/instructors can **revoke** invites and **disable** accounts.

## Decisions (locked)

| Decision | Choice |
|---|---|
| Email delivery | **Manual copy-card** — system renders a copyable card; no SMTP/provider |
| Google OAuth | **Removed entirely** — email + password (set via magic link) only |
| Revocation | **Yes** — add account `status` flag + revoke pending invites |
| Admin bootstrap | **Promote an existing user** via one-off script/SQL |
| User row timing | **Approach A** — create the `User` up-front in `invited` state; magic link activates it |

## Existing system (grounding)

- `User` model: single `role` enum (`student`/`instructor`/`admin`), **optional** `passwordHash`,
  `googleId`, **no status flag**. (`platform/prisma/schema.prisma` ~180–189)
- `Student.instructorId` already links a student to an instructor; an `assign` flow exists
  (`platform/src/students/`). "Student auto-added to instructor" maps onto this field.
- Auth: Passport local + jwt + google strategies; JWT in `bc.access` cookie, refresh in
  `bc.refresh`; bcryptjs cost 10. (`platform/src/auth/`)
- `POST /api/auth/register` is open self-registration — this is what we close.
- No invitation/magic-link/token code exists today.

## Data model (`platform/prisma/schema.prisma`)

```prisma
enum UserStatus {
  invited    // created, magic link outstanding, no password yet
  active     // password set, can log in
  disabled   // revoked/deactivated, cannot log in
}

enum InvitationStatus {
  pending
  accepted
  revoked
  expired
}

model User {
  // ...existing fields...
  status UserStatus @default(active)  // existing rows backfill to active
  // googleId column stays in schema; OAuth code path removed
}

model Invitation {
  id          String           @id @default(uuid()) @db.Uuid
  email       String                                  // denormalized for display
  userId      String           @db.Uuid               // the pending User created up-front
  user        User             @relation(fields: [userId], references: [id])
  invitedById String           @db.Uuid               // admin/instructor User.id
  role        UserRole                                 // role being granted
  tokenHash   String           @unique                // sha256(token); raw token never stored
  status      InvitationStatus @default(pending)
  expiresAt   DateTime
  acceptedAt  DateTime?
  createdAt   DateTime         @default(now())

  @@index([userId])
}
```

**Migration:** additive. Backfill all existing `User` rows to `status = active`.
No published/versioned content rows are touched (project immutability rule respected).

## Invitation lifecycle

1. **Issue** — inviter picks an email (+ role).
   - Create `User { status: invited, passwordHash: null, role }`.
   - If `role === student`: also create `Student { instructorId: <inviter userId> }` so the
     student appears in the instructor's roster as **pending**.
   - Generate a 32-byte random token (`crypto.randomBytes(32)`), store only
     `tokenHash = sha256(token)`, set `expiresAt = now + 7d`.
   - Return the **raw token once** to build the link.
2. **The card** — frontend renders a copyable card: invitee email, magic link
   (`/accept-invite?token=…`), expiry, and a Copy button. No email is sent by the system.
3. **Accept** — `/accept-invite?token=…` → set-password page →
   `POST /api/auth/accept-invite { token, password }`:
   - hash the raw token, look up `Invitation` by `tokenHash`,
   - verify `status === pending` and `now < expiresAt`,
   - set `User.passwordHash`, `User.status = active`,
   - set `Invitation.status = accepted`, `acceptedAt = now`,
   - issue normal JWT cookies (auto-login). Student is already linked to instructor.
4. **Revoke** — inviter/admin → `Invitation.status = revoked`, `User.status = disabled`.
5. **Expiry** — past `expiresAt`, accept is rejected; lazy check sets `status = expired`.

## Auth changes (closing the open door)

- **Remove** `POST /api/auth/register` and `AuthService.register`.
- **Remove Google OAuth entirely**: delete `google.strategy.ts`, the `/api/auth/google`
  and `/api/auth/google/callback` routes, remove passport-google wiring; `/api/auth/providers`
  reports no SSO available.
- **`login` rejects non-active users**: `status !== active` → `UnauthorizedException`
  (covers both `invited` and `disabled`).

## API surface

New `InvitationsController`:

| Method | Route | Guard | Purpose |
|---|---|---|---|
| `POST` | `/api/invitations` | `JwtAuthGuard` + `RolesGuard` | Create invite. **admin** → role `instructor`/`admin`; **instructor** → role `student` only (auto-links to self) |
| `GET`  | `/api/invitations` | `JwtAuthGuard` + `RolesGuard` | List issued invites (admin sees all; instructor sees own) |
| `POST` | `/api/invitations/:id/revoke` | `JwtAuthGuard` + `RolesGuard` | Revoke a pending invite |
| `POST` | `/api/auth/accept-invite` | public | Activate account, set password, auto-login |

**Authorization rules (server-enforced):**
- Instructor may only invite `student`; the server forces `role = student` and ignores any
  client-sent role.
- Only admin may mint `instructor`/`admin`.
- Instructor may revoke only invites they issued (`invitedById === self`); admin may revoke any.

## Frontend (web app, two-repo)

- **Admin page:** "Invite instructor" form → renders invitation card; lists pending/accepted/revoked.
- **Instructor page (roster):** "Invite student" form → same card component; invited students
  appear as `pending` in the roster.
- **`/accept-invite`:** token-driven set-password page; on success the user is logged in and
  redirected to their role's home.
- **Shared `InvitationCard` component** used by both inviter pages (email, link, expiry, Copy).

## Error handling & security

- Invalid / expired / used / revoked token → generic `400 Invalid or expired invitation`
  (no enumeration of which condition failed).
- Tokens: opaque, hashed at rest (sha256), single-use, 7-day TTL.
- Re-inviting an existing **active** email → `409 Conflict`.
- Re-inviting a still-`invited` email → rotate token (new card); old link is invalidated.
- Password strength via existing `class-validator` DTO rules.

## Testing

**Unit:**
- token hash/verify, expiry boundary, single-use enforcement,
- role-permission matrix (instructor cannot mint instructor/admin),
- `login` blocks `invited` and `disabled` users.

**E2E (supertest):**
- admin invites instructor → accept → login succeeds,
- instructor invites student → student `Student.instructorId` == inviter,
- revoke → subsequent login blocked,
- expired token → accept rejected,
- old `POST /api/auth/register` → `404`,
- Google routes removed → `404`.

## Out of scope (YAGNI)

- Automated email sending (SMTP/provider).
- Bulk/CSV invites.
- Re-sending email (card can be re-copied; re-invite rotates token).
- Self-service password reset (separate feature).
