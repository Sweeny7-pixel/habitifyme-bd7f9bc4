## Verify Google OAuth end-to-end

Run a headless Playwright check against the live preview to confirm the `/auth` → Google → session flow works.

### Steps

1. **Static review** of `src/routes/auth.tsx` and `src/integrations/lovable/index.ts` to confirm:
   - `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" })` is wired to the button.
   - The wrapper calls `supabase.auth.setSession(result.tokens)` on non-redirected results.
   - No custom `/login?google=1` or `window.open` detours.

2. **Provider config check** via `supabase--debug_oauth_server` (read-only) to confirm Google is enabled and Site URL is correct.

3. **Playwright run** (headless Chromium at `http://localhost:8080/auth`, viewport 1280x1800):
   - Screenshot the sign-in page; assert the "Continue with Google" button is visible and clickable.
   - Click it; capture the popup/redirect target URL and verify it points at `accounts.google.com/o/oauth2/...` with the expected `client_id`, `redirect_uri` (Lovable OAuth broker), `response_type=code`, and `scope` including `openid email profile`.
   - Capture console + network logs during the click for any 4xx/5xx from the broker or Supabase token endpoint.
   - Because we can't complete real Google consent headlessly, stop at the provider URL and report it as the pass/fail signal for the outbound half.

4. **Session-set half** (the part after Google returns) — simulated:
   - Inspect the `web_message` postMessage handler in `@lovable.dev/cloud-auth-js` by triggering the sign-in flow and confirming the listener is registered (via `window` inspection in Playwright before click).
   - Report whether `supabase.auth.setSession` is invoked in the wrapper based on code path review, since we can't mint a real Google id_token in the sandbox.

5. **Report** with screenshots, the exact Google authorize URL, any console/network errors, and a clear pass/fail per half (outbound redirect vs. inbound setSession). If anything fails, propose the fix in a follow-up plan — no code changes this turn.

### Out of scope

- No code edits.
- No changes to Supabase auth config.
- No real Google account sign-in (not possible headlessly / not safe with user creds).
