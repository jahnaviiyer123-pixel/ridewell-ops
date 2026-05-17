# RideWell Ops — Internal Tool for 2-Wheeler Driving School

## Original Problem Statement
> "we are currently running an 2 wheel driving comapny we need an interal tool where people be like used to update things like what is going on like people when are they joining and how amny classeds they left and people and attendance of trainers and all need to be done basically"

## User Choices (confirmed)
- Auth: simple username/password (JWT)
- Roles: Admin + Trainer logins
- Modules: Student management, Class tracking (10 classes/student, editable by trainers), Trainer management, Trainer attendance, Payments, Reports
- Class details (date, status, notes, trainer) must be editable

## Personas
- **Admin / Manager** — full access: CRUD students, CRUD trainers, payments, all attendance, reports
- **Trainer** — can view students, edit class records, mark own attendance, record payments, view reports

## Architecture
- **Backend**: FastAPI + Motor (async MongoDB). Single `server.py`. All routes under `/api`. JWT auth (httpOnly cookies + Bearer fallback), bcrypt password hashing. Seeds `admin@ridewell.com` and demo `trainer@ridewell.com` on startup.
- **Frontend**: React 19 + React Router v7. Swiss / high-contrast industrial theme (Chivo + IBM Plex Sans). Tailwind utility classes with `rounded-none` cards, zinc palette, blue primary, yellow accent. Phosphor Icons. Sonner for toasts.
- **DB Collections**: `users`, `students`, `classes` (10 rows per student), `attendance` (unique per trainer+date), `payments`.

## Implemented (2026-02 — Day 1)
- [x] JWT login/logout/me with admin + trainer roles
- [x] Students list, create (auto-generates 10 class slots), view, edit, delete
- [x] Per-student class tracker with visual 10-block grid + editable class table (date, trainer, status, notes)
- [x] Trainers list + admin-only create / edit / delete dialogs
- [x] Daily trainer attendance (present / absent / leave) — upsert per date
- [x] Payments: per-student ledger + global payments page + auto fees_paid increment
- [x] Dashboard stats: total/active students, trainers, today's classes, pending fees
- [x] Daily Reports page with classes, attendance, payments for selected date
- [x] Swiss industrial design (Chivo/IBM Plex), sharp edges, bento grid, sticky sidebar

## Test Credentials
- Admin: `admin@ridewell.com / admin123`
- Trainer: `trainer@ridewell.com / trainer123`

## Backlog (P1)
- Backend: admin-only gate on PATCH /api/students for fees/status fields
- Backend: validate student_id on POST /api/payments (avoid orphan ledger rows)
- Backend: unify "today" timezone between `/dashboard/stats` and `/reports/daily`
- Students list: N+1 query — aggregate classes_completed in single pipeline
- Filters on Students page (by trainer, status, pending fees)

## Backlog (P2)
- CSV export of payments / attendance / students
- Bulk attendance (mark all present)
- Weekly/monthly reports with charts
- Student profile photos (object storage)
- Trainer dashboard view: only their assigned students
- SMS reminders for upcoming classes (Twilio)

## Next Action Items
- Frontend UI smoke test end-to-end
- Tighten admin-only permissions for sensitive student fields
- Add filters/search on Students & Payments pages
