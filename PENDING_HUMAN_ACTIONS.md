# Pending Human Actions

- Restrict LiveKit webhook endpoint to LiveKit's source IPs via OCI Security List once deployed.

### Break-Glass Owner Recovery
If all owner accounts are accidentally locked out (e.g., forgotten passwords, inadvertent deactivation before the A-P8-05 fix), use the hardened backend CLI script to recover access directly on the server without needing a UI:
1. SSH into the production server.
2. Navigate to the backend directory and activate the virtual environment.
3. Run the reset_pw.py script to force-reset an owner's password or reactivate an account.
   Syntax: python reset_pw.py <username> <new_password>
   Note: The eset_pw.py script has been updated to require explicit credentials and no longer contains hardcoded fallbacks, ensuring security.


### Least-Privilege Application Database Role
True grant-based DB immutability requires a dedicated least-privilege application role instead of superuser. Currently, the Django app connects to Postgres as the "postgres" superuser role (as seen in POSTGRES_USER in the actual DB connection/env). The DB trigger added for A-P2-07 provides a real but partial mitigation for SystemLog immutability, but a superuser can technically bypass triggers. A dedicated role should be created in the future.

### UX/IA Consistency & De-duplication Sweep
Owner has flagged a general concern — the app may have duplicate pages/features/routes and inconsistent organization across the sidebar and dashboard, compared to other professional academy platforms they've seen. Needs a dedicated UX/IA Consistency & De-duplication Sweep once the current LAUNCH-BLOCKING + MEDIUM queue is done: inventory every route/page/component, flag overlapping or redundant functionality in plain language (not code), produce a report for the owner to review and make calls on, before any cleanup work begins.

### Parent Account Enrollment Confirmation (A-P8-06)
A data-entry misassignment of the `parent_account` Foreign Key on a Student record causes one parent to see another family's child's data (GDPR/COPPA risk). Since this is a data quality issue rather than a code logic bug, a UI confirmation step should be added to the enrollment flow. The UI must explicitly show the parent's full name and details before saving the relationship. Additionally, an audit log hook should be implemented to record every change to a student's `parent_account` field.
