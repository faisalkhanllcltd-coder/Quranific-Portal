# P6 — Performance

**Status: DONE**
Audit date: 2026-07-17

---

## Findings

### [CRITICAL] `GET /api/students/` generates 3N+2 queries per request (N+1 storm)
- Where: `students/serializers.py:61-63`, `students/views.py:74`
- Issue: Already documented in P2. Primary performance finding.
- Additional evidence: Dashboard page, Analytics page, Attendance page, StudentList page ALL call `GET /api/students/` on initial load. With N=100 students and 4 concurrent page loads = 4 × (3×100 + 2) ≈ **1208 DB queries** from a single page view for one user. At OCI free tier PostgreSQL limits, this will cause timeout cascades.
- Fix direction: `prefetch_related('student_daily_attendance', 'assignments', 'study_materials')` on `StudentViewSet.get_queryset()`; create a lightweight `StudentListSerializer` without nested relations for list views
- Effort: S

### [CRITICAL] No database connection pooling configured
- Where: `config/settings.py:99-108`
- Issue: Django's default `DATABASES` config has no `CONN_MAX_AGE` setting. Every request opens a new PostgreSQL connection (cold TCP + auth), waits for it, then closes it. The default `CONN_MAX_AGE=0` means connection-per-request mode.
- Impact: Under concurrent load (5+ simultaneous users), PostgreSQL connection limits can be hit; each request adds 10-50ms of connection overhead; no connection reuse
- Fix direction: Set `CONN_MAX_AGE=60` in `DATABASES['default']` settings; consider PgBouncer as a connection pooler in OCI deployment
- Effort: S

### [HIGH] `TeacherListSerializer.get_classes()` is an N+1 query on teacher list
- Where: `accounts/serializers.py:44-54`
- Issue: Already documented in P2. Added here for performance tracking.
- Fix direction: Annotate `TeacherViewSet.queryset` with student count
- Effort: M

### [HIGH] OwnerDashboard fires 4 concurrent API calls on every mount — cumulative N+1 risk
- Where: `frontend/src/pages/dashboards/OwnerDashboard.jsx:55-59`
- Issue: `Promise.all([students, teachers, payments, attendance])` — 4 simultaneous requests. `students` triggers 3N+2 DB queries. `teachers` triggers N+1 queries. `payments` and `attendance` are simpler. Combined: a single dashboard page load can generate 1000+ DB queries for a modest academy.
- Impact: Dashboard is the first page every user sees; it is the most performance-critical page and is simultaneously the most DB-expensive
- Fix direction: Beyond the N+1 fix, consider a dedicated `GET /api/dashboard/summary/` endpoint that returns all KPI data in one DB query using aggregation (`Count`, `Sum`, `annotate`) — eliminates 4 network round-trips from frontend to backend
- Effort: L

### [HIGH] `SystemAccessViewSet.list()` returns un-paginated list of ALL users
- Where: `accounts/views.py:295-312`
- Issue: Python for loop over ALL users with no `LIMIT` or pagination. At 1000 users, this fetches all 1000 rows, serializes them in Python, and returns them in one HTTP response.
- Impact: Memory spike; slow response; JSON response can be megabytes in size
- Fix direction: Convert to paginated `ListAPIView` with DRF pagination; add role-based query filters
- Effort: S

### [MEDIUM] Redis is provisioned but unused — no caching layer
- Where: `docker-compose.yml:25-37`
- Issue: Already documented in P0. No `django-redis` or cache configuration. `django.core.cache.backends.locmem.LocMemCache` is the default — per-process, not shared between gunicorn workers. Cache misses on every multi-worker request.
- Impact: No HTTP response caching; no queryset caching; computationally expensive operations (payroll calculation, analytics) re-run on every request
- Fix direction: Configure `django-redis` as cache backend; apply `@cache_page(300)` to analytics and payroll endpoints; cache student count aggregations
- Effort: M

### [MEDIUM] Frontend has no request deduplication or global loading state
- Where: Multiple dashboards
- Issue: Multiple components independently fetch `GET /api/students/` — e.g., `OwnerDashboard`, `Analytics`, `FinanceHub`, `StudentList` all mount and each fires its own independent request. If a user navigates between tabs rapidly, these requests stack up.
- Impact: Redundant API calls increase server load; stale data possible if responses arrive out of order
- Fix direction: Implement a lightweight data-fetching library (React Query, SWR) with deduplication and stale-while-revalidate; or implement a global data cache in React Context
- Effort: M

### [MEDIUM] LiveKit container uses `livekit/livekit-server:latest` — no version pin
- Where: `docker-compose.yml:41`
- Issue: `image: livekit/livekit-server:latest` — `latest` tag mutates on every `docker-compose pull`. A LiveKit update could break the WebRTC room API without warning.
- Impact: Deployment could break silently after an image pull; no reproducible builds
- Fix direction: Pin to a specific version tag, e.g., `livekit/livekit-server:v1.7.2`
- Effort: S

### [LOW] Vite build has no bundle analysis or code-splitting strategy
- Where: `frontend/package.json` / `vite.config.js`
- Issue: No `rollupOptions.output.manualChunks` or `import()` lazy loading for heavy pages like `Classroom.jsx` (includes livekit-client) and `Analytics.jsx`. All bundles load on first paint.
- Impact: Initial JS bundle larger than necessary; slower LCP on mobile
- Fix direction: Lazy-load route components with `React.lazy()`; split `livekit-client` into its own chunk
- Effort: M

### [LOW] No CDN or static file caching headers configured
- Where: Deployment configuration (not yet audited for P7)
- Issue: No Nginx, Caddy, or CDN configuration is present in the repo. Vite build outputs go to `dist/` but no static file serving strategy is documented.
- Impact: Static assets served directly from backend/app server; no gzip/brotli; no Cache-Control headers; high latency for students on slow connections (target audience is global, likely developing world)
- Fix direction: Document Nginx reverse proxy config with `gzip on`, `Cache-Control: max-age=31536000, immutable` for hashed assets, and `HTTPS` termination; use OCI CDN or Cloudflare
- Effort: M
