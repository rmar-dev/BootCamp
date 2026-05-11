# Auth

## Purpose
Authenticate users (Google OAuth, local email/password), issue and verify JWTs, and enforce role-based access control across the platform.

## Owns
- `platform/src/auth/` including strategies, guards, decorators, and `user.repository.ts`
- Prisma `User` model, `UserRole` enum, JWT/cookie contract

## Key Interfaces
- `POST /auth/login` (local) and `GET /auth/google` → `GET /auth/google/callback` (OAuth)
- `JwtAuthGuard` — applied to protected routes
- `@Roles('student' | 'instructor' | 'admin')` + `RolesGuard` — role enforcement
- `@CurrentUser()` — decorator exposing the authenticated user in controllers

## Dependencies
- Prisma (User table)
- `Student.userId` FK from the Grading flow's student provisioning (`ensure-student.ts`)
