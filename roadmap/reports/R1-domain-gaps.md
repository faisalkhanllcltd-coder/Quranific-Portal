# R1 — Domain Feature Gaps

**Status: DONE**
Analysis date: 2026-07-17

All findings verified against actual code. No guesses.

---

### [ADD] Quran curriculum / Hifz progress tracker
- Area: domain-feature
- Where: N/A — new capability (`students/models.py` had `current_surah` but it was deleted in migration 0002)
- Why: The academy's core product is Quran memorization. There is no model for Surah, Juz, Hifz progress, or revision schedule anywhere in the codebase. Attendance is the only academic record. A student's learning path is entirely invisible to the platform.
- Business impact: Without progress tracking, parent retention is zero — parents need to see what their child has memorized. This is table-stakes for any Quran academy SaaS.
- Effort: M
- Priority: LAUNCH-BLOCKING

### [ADD] Server-side class scheduling (timezone-aware, recurring)
- Area: domain-feature
- Where: `students/models.py:80` — `class_timing = CharField(max_length=100)` free text, e.g. `"5:00 PM - 6:00 PM"`
- Why: No structured Schedule model exists. Teacher dashboard groups students by free-text slot string (`TeacherDashboard.jsx:83-87`). No timezone storage, no conflict detection, no recurring session pattern. International students (diaspora) in different timezones see the same local-time string with no conversion.
- Business impact: A UK-based student and a Pakistan-based student with the same teacher both see `"5:00 PM"` — whose timezone? Teacher overbooking is undetectable. This breaks usability for any international student.
- Effort: M
- Priority: LAUNCH-BLOCKING

### [ADD] Email / SMS notification delivery
- Area: domain-feature
- Where: N/A — entirely absent. No SMTP, SendGrid, Twilio, or Firebase configuration in any backend file.
- Why: Zero server-side notifications. Reminder for payment due, class starting, absence alert — all rely on the admin manually copying a WhatsApp link from the UI. Zero automated delivery.
- Business impact: Payment default rate increases without automated dunning. Teacher absences go unnoticed. Parents who miss a WhatsApp message have no fallback. For a children's platform, parent engagement requires proactive communication.
- Effort: M
- Priority: LAUNCH-BLOCKING

### [ADD] Admissions / trial-class intake funnel (public form)
- Area: domain-feature
- Where: N/A — enrollment is 100% admin-created via `StudentList.jsx` drawer. No public-facing page.
- Why: There is no way for a prospective parent to book a trial class without contacting the academy directly. Growth requires a conversion funnel: landing page → form submission → trial booking → enrollment → payment.
- Business impact: Manual-only enrollment caps capacity at the speed of admin data entry. Every competitor SaaS (Teachworks, TutorBird) has a public booking form. Without it, the platform cannot scale past the founder's personal network.
- Effort: L
- Priority: FAST-FOLLOW

### [ADD] In-platform messaging (teacher ↔ student ↔ guardian)
- Area: domain-feature
- Where: N/A — only communication is external WhatsApp links (`FinanceHub.jsx:334`). No internal messaging model exists.
- Why: Platform stickiness depends on keeping communication inside. Currently all teacher-guardian communication happens off-platform, meaning the academy loses visibility, accountability, and engagement data.
- Business impact: Platform becomes a glorified attendance tracker rather than the primary communication hub. Parents will disengage. High churn risk.
- Effort: L
- Priority: FAST-FOLLOW

### [ADD] Certificate / progress report PDF generation
- Area: domain-feature
- Where: N/A — no PDF generation library (`reportlab`, `weasyprint`, `puppeteer`) is installed.
- Why: No mechanism to issue Hifz completion certificates, monthly progress reports, or attendance summaries. For a Quran academy, certificates are a core motivational and marketing tool — parents share them, students frame them.
- Business impact: Direct retention and word-of-mouth impact. Academies that issue certificates have measurably higher completion rates.
- Effort: M
- Priority: FAST-FOLLOW

### [ADD] Class session recording storage + playback
- Area: domain-feature
- Where: N/A — `StudentDashboard.jsx:293` has hardcoded placeholder text `"Session recorded at 10:00 AM"` with a static record list. No LiveKit egress/recording configuration exists in `livekit.yaml` or any backend view.
- Why: Students who miss a class cannot review it. Recording is a standard expectation for online tutoring platforms in 2025. LiveKit supports egress (S3-compatible recording) natively, but it is not configured.
- Business impact: Recorded sessions reduce churn from missed classes. High value-add for premium tier. Also provides accountability if student/teacher disputes arise.
- Effort: L
- Priority: FAST-FOLLOW

### [ADD] Multi-currency and invoice/receipt generation
- Area: domain-feature
- Where: `FinanceHub.jsx:138` — hardcoded `$50` per student. `payments/models.py` stores `amount` as a `DecimalField` with no currency field.
- Why: International students pay in GBP, USD, PKR, AED depending on location. All amounts in the system are currency-ambiguous — the `$` symbol is assumed everywhere but never enforced. No invoice PDF or receipt generation exists.
- Business impact: International academy serving diaspora students cannot legally issue invoices without proper currency labeling. Accounting reconciliation is impossible across currencies.
- Effort: M
- Priority: FAST-FOLLOW

### [ADD] AI Watchdog — deferred, but dead references should be cleaned
- Area: domain-feature / platform-maturity
- Where: `ai_bot/` directory (empty), `.env:OPENAI_API_KEY=sk-xxxx...`
- Why: The feature is genuinely deferred (zero implementation), but the empty directory and placeholder API key create confusion and security risk. This is a REMOVE finding more than an ADD — see R2.
- Business impact: No business impact until implemented; clean deferral reduces operator confusion.
- Effort: S
- Priority: LATER

### [ADD] Gamification / retention mechanics (streaks, badges)
- Area: domain-feature
- Where: N/A — zero implementation confirmed by grep
- Why: EdTech platforms with Quran focus (e.g. Tarteel, Quran.com) use streak mechanics to drive daily engagement. Given the target audience (children), gamification has outsized retention impact.
- Business impact: Significant retention lever for student-facing experience; reduces dropout rate.
- Effort: L
- Priority: LATER

---

### [IMPROVE] Guardian/parent portal — exists but shallow
- Area: domain-feature
- Where: `frontend/src/pages/dashboards/ParentDashboard.jsx` exists
- Why: Parent portal shows child's `class_timing` (a free-text string), attendance list, and payment history. It does NOT show: assignments, submission grades, study materials, teacher contact, or any progress metric. The portal surface area is significantly below what a parent needs to assess their child's education.
- Business impact: Parents who can't see learning outcomes cancel subscriptions. Parent dashboard depth is a direct retention metric.
- Effort: M
- Priority: FAST-FOLLOW

### [IMPROVE] Class scheduling — free-text to structured model
- Area: domain-feature
- Where: `students/models.py:80`
- Why: Already covered in ADD above. If full ADD is too much for launch, at minimum convert `class_timing` to a structured `TimeField + days_of_week + timezone` to enable reliable scheduling display across timezones.
- Business impact: Prevents timezone confusion for international students.
- Effort: S
- Priority: LAUNCH-BLOCKING

### [IMPROVE] Assignment / submission — grade field is a free-text CharField
- Area: domain-feature  
- Where: `students/models.py:162` — `grade = models.CharField(max_length=50, blank=True)`
- Why: Grade is a free-text string. No rubric, no numeric scale, no percentage. "Excellent", "Pass", "10/10", "A+" all co-exist with no standardization. Analytics on academic performance are impossible.
- Business impact: Cannot generate meaningful progress reports or performance analytics without a standardized grading scheme.
- Effort: S
- Priority: FAST-FOLLOW

### [IMPROVE] RTL / Arabic UI — zero support, high urgency for target market
- Area: domain-feature
- Where: All JSX files — zero `dir="rtl"` usage, no i18n library, no Arabic strings
- Why: The product name is Quranific, target teachers are Arabic-speaking ustads, and the subject matter is the Arabic Quran. UI is 100% English-only left-to-right. Arabic or Urdu-language users cannot use the interface in their native script.
- Business impact: Eliminates an enormous share of the target market (Arabic-speaking teachers and parents). Competitor platforms (Quranic, Bayyinah TV) have Arabic UI.
- Effort: L
- Priority: FAST-FOLLOW
