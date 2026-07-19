"""
reset_pw.py — Emergency password reset utility for Quranific Portal.

R-R2-03 FIX: Removed hardcoded username ('quranific') and password
('BROTHERfaisal.edu,123') that were committed to the repo. Credentials
are now passed as CLI arguments so nothing sensitive is ever in source code.

USAGE (run from the backend/ directory with venv active):
    python reset_pw.py <username> <new_password>

EXAMPLES:
    python reset_pw.py quranific MyNewSecurePass123!
    python reset_pw.py admin_user AnotherStrongPass@456

SECURITY NOTES:
- This script must NEVER be committed with real credentials inline.
- On OCI: run via SSH, pass args inline — they will not appear in ps output
  if the shell is not logged (use: python reset_pw.py <user> <pass> 2>&1).
- This script does NOT auto-create missing users. Use Django's
  `manage.py createsuperuser` for new account creation.
- Delete or chmod 700 this file after emergency use if on a shared host.
"""

import os
import sys
import django

# ── Arg validation before Django setup (fail fast) ──────────────────────────
if len(sys.argv) != 3:
    print()
    print("  USAGE:  python reset_pw.py <username> <new_password>")
    print()
    print("  ERROR:  Exactly 2 arguments required.")
    print("          No hardcoded credentials — pass them on the command line.")
    print()
    sys.exit(1)

target_username = sys.argv[1].strip()
new_password    = sys.argv[2]   # do not strip — password may have leading/trailing spaces intentionally

if not target_username:
    print("ERROR: Username cannot be empty.")
    sys.exit(1)

if len(new_password) < 10:
    print("ERROR: Password must be at least 10 characters.")
    sys.exit(1)

# ── Django setup ─────────────────────────────────────────────────────────────
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth import get_user_model
User = get_user_model()

# ── Password reset (update only — no auto-create) ────────────────────────────
try:
    user = User.objects.get(username=target_username)
    user.set_password(new_password)
    user.save(update_fields=['password'])
    print(f"SUCCESS: Password updated for '{target_username}'.")
    print("         All existing sessions for this user are now invalid.")
    print("         If JWT blacklisting is active, existing tokens remain valid until expiry.")
except User.DoesNotExist:
    print(f"ERROR: User '{target_username}' does not exist.")
    print("       To create a new superuser, use:  python manage.py createsuperuser")
    sys.exit(1)
except Exception as e:
    print(f"ERROR: {e}")
    sys.exit(1)
