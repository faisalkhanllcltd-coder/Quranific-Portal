# R4 — Edge Performance (International Users)

**Status: DONE**
Analysis date: 2026-07-17

---

### [ADD] CDN for static assets
- Area: edge-performance
- Where: `config/settings.py:145` — `STATIC_URL = 'static/'`; no CDN configuration
- Why: Vite build outputs hashed JS/CSS bundles to `dist/`. These are currently planned to be served directly from the app server (or Nginx on the same host). For international students (diaspora in UK, US, Europe), each page load fetches multiple 100KB+ JS chunks from a single OCI region (assumed: Dubai/Hyderabad) with no geographic edge distribution. React 19 + Tailwind + livekit-client bundles will be 500KB+ gzipped.
- Business impact: Time-to-interactive for a UK student hits 2-4s on a 20Mbps connection from a single OCI origin vs. <500ms with a CDN edge node. This directly impacts LiveKit pre-class load time — the moment a student is most likely to abandon.
- Effort: M
- Priority: FAST-FOLLOW

### [ADD] Adaptive bitrate / compression for class recording playback
- Area: edge-performance / domain-feature
- Where: N/A — recordings not yet implemented (R1 ADD)
- Why: When recording is added, raw LiveKit egress outputs are high-bitrate MP4. Students on mobile data in developing countries (Pakistan, Bangladesh) cannot buffer 720p/1080p streams. No transcoding pipeline is planned.
- Business impact: Recording playback is unusable on slow connections without HLS/DASH adaptive streaming.
- Effort: L
- Priority: LATER (depends on recording ADD being implemented first)

### [ADD] API response field trimming for list endpoints (projection)
- Area: edge-performance / architecture
- Where: `students/serializers.py:73-80` — `StudentSerializer` returns full model: 20+ fields per student including guardian contact details. `GET /api/students/` called from every dashboard page. Frontend only uses `id`, `full_name`, `status`, `assigned_teacher`, `class_timing` for list rendering.
- Why: Each student object in the list response is ~800 bytes. At 200 students, that's 160KB of JSON per request. The `OwnerDashboard` fires this 4 times on mount. Over a 4G connection (10Mbps), this adds ~130ms transfer time per request — before parsing.
- Business impact: Measurable page-load improvement (especially on mobile) by implementing a lightweight `StudentListSerializer` (10 fields) for list views vs. `StudentDetailSerializer` (all fields) for retrieve views.
- Effort: S
- Priority: FAST-FOLLOW

### [ADD] LiveKit edge region selection
- Area: edge-performance
- Where: `livekit/livekit.yaml:1` — single server, no regions
- Why: A single LiveKit SFU instance in one OCI datacenter adds 150-300ms of RTP latency for students geographically distant from the server. For a Karachi-based academy serving students in London, this means noticeably degraded video quality. LiveKit Cloud supports multi-region; self-hosted requires deploying edge SFU nodes.
- Business impact: Video quality determines session completion rate. For a Quran recitation class, audio latency above 200ms breaks the teacher-student correction flow.
- Effort: L
- Priority: FAST-FOLLOW

---

### [IMPROVE] API response payload — `StudentSerializer` over-fetches for list views
- Area: edge-performance
- Where: `students/serializers.py:73-80`
- Why: Already documented in ADD above — the list serializer and detail serializer are the same class. This is architectural debt causing both N+1 queries (P2/P6 audit) AND over-fetch payload issues.
- Business impact: Fix kills two birds: reduces DB query count AND reduces network payload size.
- Effort: S
- Priority: LAUNCH-BLOCKING (combined with N+1 fix from audit)

### [IMPROVE] `SystemLog` / `AdminHub` audit log — un-paginated table with no server-side filter
- Area: edge-performance
- Where: `AdminHub.jsx:246-280` — renders `logs.slice(0,50)` (client-side slice of full response). `log/views.py` — `SystemLog.objects.all().select_related('user')` (no limit).
- Why: The audit log grows by 1 entry per admin action. After 6 months of operation (200 admin actions/day × 180 days = 36,000 rows), this endpoint returns 36,000 log entries as a single JSON payload. `AdminHub.jsx` then does a client-side `.slice(0, 50)` — the other 35,950 entries are transferred, parsed, and discarded.
- Business impact: AdminHub becomes unusable after ~3 months of operation. Log download CSV already generated client-side from the full dataset — will hang the browser tab.
- Effort: S (add DRF pagination + server-side date/user filter to `SystemLogViewSet`)
- Priority: FAST-FOLLOW

### [IMPROVE] Frontend API calls — no request deduplication, no caching layer
- Area: edge-performance
- Where: Multiple dashboard components
- Why: `OwnerDashboard`, `Analytics`, `FinanceHub`, `StudentList` each independently fetch `GET /api/students/` with separate `useEffect` calls. Navigating between tabs re-fires all requests. No SWR, no React Query, no shared cache.
- Business impact: 4x unnecessary API calls on navigation. On a 200-student academy, this means 4 × 1208 = 4832 DB queries per user session just from tab switching.
- Effort: M (introduce React Query or SWR globally)
- Priority: FAST-FOLLOW
