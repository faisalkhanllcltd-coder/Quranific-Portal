# P5 — UX & Accessibility

Audit date: 2026-07-17

---

## Findings

### [HIGH] Child password shown in plaintext during enrollment — COPPA/GDPR concern
- Where: `frontend/src/pages/StudentList.jsx:479, 495` (credentials display card)
- Issue: After enrollment, the student's password is rendered in plaintext on screen in a `select-all` styled div. While intentional for copy-paste, there is no auto-dismiss or session-level hiding. Any person near the screen sees the child's password.
- Impact: For a children's Quran academy, this is a child safety concern. If a parent or sibling reads the child's credentials, they can access the child's account.
- Fix direction: Mask password behind a "show" toggle; add a "credentials will not be shown again" warning; encourage password change on first login
- Effort: S

### [HIGH] No loading state or error handling when `ProtectedRoute` verifies token
- Where: `frontend/src/App.jsx` (ProtectedRoute implementation — not yet fully read)
- Issue: [SUSPECTED based on Dashboard.jsx:18] `token = localStorage.getItem('access')` is a synchronous check. If the token is present but expired and the silent refresh fails, the user is stuck in an inconsistent state — they can see role-gated UI for a moment before being redirected.
- Impact: Flash of unauthorized content (FOUC for role-gated pages) possible; poor UX on session expiry
- Fix direction: Add a `useAuth` hook that validates token freshness before rendering; show a loading spinner during validation
- Effort: M

### [MEDIUM] No global error boundary at the route level
- Where: `frontend/src/App.jsx`
- Issue: `ErrorBoundary.jsx` exists but is not visible in the routing structure viewed. If it is not wrapping each route, an unhandled render error in one page will crash the entire SPA.
- Impact: A runtime error on the `FinanceHub.jsx` or `AdminHub.jsx` (both complex) takes down the whole app for the user, with no way to navigate to another page
- Fix direction: Wrap each `<Route>` element with `<ErrorBoundary>` or wrap the entire `<Routes>` tree
- Effort: S

### [MEDIUM] No `<title>` tags per page — all pages use app-level `<title>`
- Where: `index.html` (Vite default); individual page components
- Issue: There is no `document.title` update per route. Every page shows the same browser tab title regardless of which page the user is on.
- Impact: Poor UX for users with many tabs; accessibility issue for screen-reader users navigating with title announcements
- Fix direction: Use `useEffect` to update `document.title` per page, or add a `react-helmet` equivalent
- Effort: S

### [MEDIUM] No keyboard navigation or ARIA labels on custom role-gated action buttons
- Where: Multiple pages — `StudentList.jsx:395`, `Attendance.jsx` action buttons, `FinanceHub.jsx:333`
- Issue: Custom action buttons (edit, delete, mark attendance) have no `aria-label` and rely solely on visual icons. `<button>` elements with only `<Trash2 size={16}/>` as content have no accessible name.
- Impact: Screen reader users cannot identify the purpose of these buttons; fails WCAG 2.1 AA criterion 4.1.2 (Name, Role, Value)
- Fix direction: Add `aria-label="Delete student {student.full_name}"` to icon-only buttons; ensure focus ring is visible
- Effort: S

### [MEDIUM] WhatsApp number field has no format validation
- Where: `StudentList.jsx:620` (guardian_whatsapp input), `FinanceHub.jsx:333` (wa.me URL)
- Issue: WhatsApp number is a free-text input with no format validation. The wa.me redirect strips non-digit characters (`/\D/g`) but if the number has a format error (e.g., missing country code), the link silently fails.
- Impact: WhatsApp reminder feature is unreliable; admin wastes time sending broken links
- Fix direction: Add phone number format validation (e.g., E.164 format) on frontend and backend
- Effort: S

### [LOW] Duplicate student status filtering — backend and frontend filter independently
- Where: `StudentList.jsx:62-64`
- Issue: Teacher gets full server-filtered list then frontend filters again (as documented in P3). But status filters (Active/Trial/Left) are done only client-side via `students.filter(s => s.status?.toLowerCase() === ...)`. With large datasets, this client-side filter runs on all loaded students.
- Impact: If 1000 students are loaded (no pagination), client-side filtering is slow on mobile
- Fix direction: Add server-side `?status=Joined` filter support to `StudentViewSet`; use URL query params
- Effort: S

### [LOW] Mobile layout not verified for `Classroom.jsx`
- Where: `Classroom.jsx:230` — `h-screen w-screen` layout
- Issue: LiveKit `VideoConference` component renders a full-screen grid; on small mobile screens with browser chrome, this can overflow. `@livekit/components-styles` may not fully accommodate mobile viewports.
- Impact: Students joining from mobile phone (likely for children's academy) may have a broken video layout
- Fix direction: Test on iOS Safari and Android Chrome; add `env(safe-area-inset-*)` CSS padding for notched phones
- Effort: M

### [LOW] `Settings.jsx` has `console.error(err)` — raw error object leaked
- Where: `frontend/src/pages/Settings.jsx:50`
- Issue: `catch(err) { console.error(err); }` logs the full error object — potentially including HTTP response bodies with backend stack traces — to browser console
- Impact: Developer-level information visible in production browser devtools; not a direct security issue but leaks server internals
- Fix direction: Log only `err.message` or remove in production; use environment-gated logging
- Effort: S
