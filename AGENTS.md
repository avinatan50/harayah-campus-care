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
- Task updates invalidate the shared tasks query prefix; unique realtime subscriptions plus periodic reconciliation keep all views current. New request/decision statuses are enforced by the insert trigger regardless of client selection.
- Account deletion disables the target under the last-admin lock, deletes its login, then marks the detached profile as deleted for historical attribution; active user lists exclude deleted profiles to preserve task/history references without keeping login access.
- Task selectors use STATUS_OPTIONS; closed is the retained storage value for handled tasks, legacy statuses normalize on database writes, and shared TaskResolution uses an atomic authenticated RPC for notes, approved status and destination changes.
- A regular user reaches only their own calls: owner-scoped SELECT policies (created_by = auth.uid(), gated by is_active_user) on tasks, task_decisions and task_files plus the matching storage.objects read policy; the reporter history view depends on them and staff rights stay separate.
- New/replacement code pattern validation lives in the browser-safe access-code module and is enforced by both forms and server handlers; existing login codes remain usable to avoid locking out current accounts.
