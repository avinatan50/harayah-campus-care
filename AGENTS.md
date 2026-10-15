<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Login is a 4-digit code only: server functions in src/lib/auth.functions.ts HMAC the code (CODE_PEPPER), rate-limit via login_attempts, rotate a random internal password and return a session — codes never reach the browser or DB in plain text.
- Management accounts are bootstrapped once via /setup (ADMIN_SETUP_KEY + admin_seeds table); afterwards only the super admin manages roles.
- Permissions are enforced by RLS (is_staff/has_role also require profiles.active); route guards are UX only.
- Task history, waiting_since and completed_at are written only by DB triggers on tasks; never write them from the client.
- Dashboard counters and list filters must both use applyPreset() in src/lib/tasks.ts so counts match lists.
