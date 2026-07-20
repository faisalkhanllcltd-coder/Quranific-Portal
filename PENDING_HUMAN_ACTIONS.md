# Pending Human Actions

- Restrict LiveKit webhook endpoint to LiveKit's source IPs via OCI Security List once deployed.

### Break-Glass Owner Recovery
If all owner accounts are accidentally locked out (e.g., forgotten passwords, inadvertent deactivation before the A-P8-05 fix), use the hardened backend CLI script to recover access directly on the server without needing a UI:
1. SSH into the production server.
2. Navigate to the backend directory and activate the virtual environment.
3. Run the reset_pw.py script to force-reset an owner's password or reactivate an account.
   Syntax: python reset_pw.py <username> <new_password>
   Note: The eset_pw.py script has been updated to require explicit credentials and no longer contains hardcoded fallbacks, ensuring security.

