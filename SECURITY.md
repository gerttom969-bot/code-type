# CodeType security notes

## Scope

CodeType is a local-first teaching application. Authentication and progress are stored in the browser; Python code executes through Pyodide in the same browser page. This is not a production identity provider, multi-user service, or hostile-code execution platform.

## Risk register

| Boundary | Severity | Current mitigation | Remaining limit |
|---|---|---|---|
| Browser-local authentication | High for real accounts | PBKDF2-HMAC-SHA-256 via Web Crypto, random salts, generic login failure, 7-day session expiry, token rotation, client backoff | An attacker controlling the browser profile or XSS can read/modify localStorage. This is not production auth. |
| Client-side rate limiting | Medium | Exponential backoff in the auth service | Users can clear storage or modify the app. Real rate limits must run server-side. |
| User content rendered in DOM | High | DOM creation and `textContent`; no user-controlled `innerHTML` assignment | Continue reviewing every new DOM sink. Trusted static templates must not interpolate user HTML. |
| Python execution via Pyodide | Critical for untrusted code | Explicit warning and 20 KB input cap | Pyodide is not a security sandbox. Do not run code from strangers or users you do not trust. Size limits do not impose CPU, memory, filesystem, or browser API isolation. |
| Study notes and review data | Low | Normalization, bounded note length, fixed allowed identifiers, text-only rendering | Data is local and can be changed or deleted by the browser user. |
| Remote runtime dependency | Medium | Pyodide version is pinned in the HTML script URL | Availability and integrity depend on the CDN/TLS chain. Production should self-host or tightly control dependencies and use a restrictive CSP. |

## Authentication details

- New password records use PBKDF2-HMAC-SHA-256 with the configured iteration count and a random 16-byte salt.
- Legacy SHA-256 records upgrade after a successful login.
- Usernames are normalized and validated; failed logins use the same generic message.
- Sessions expire after seven days. Restore rotates the token without extending the original expiry.
- Client-side backoff is explicitly defense-in-depth, not an enforceable service control.

For production, move password verification to a trusted backend, prefer Argon2id (or a properly configured server-side bcrypt/scrypt implementation), and issue opaque session identifiers in `HttpOnly; Secure; SameSite=Lax` cookies. Add server-side rate limiting, CSRF protection for cookie-authenticated writes, audit logging, account recovery, and security monitoring.

## XSS details

- User-controlled usernames, notes, snippets, project content, and execution output must be inserted as text nodes or assigned with `textContent`.
- The application currently has tests that reject user-controlled HTML injection and verify that `main.js` and `ui/dom.js` do not assign to `innerHTML`.
- Never treat a username, file, activity message, or Python output as trusted markup.
- The `safeHtml` helper is for developer-authored static template markup only; interpolations are escaped. Prefer DOM construction and text nodes.

## Pyodide boundary

**The judge is NOT sandboxed. Only run your own code.** A learner's Python may import JavaScript interoperability modules, access browser APIs, and make network requests within the capabilities of the browser page. An import blacklist is not a security boundary and is not implemented as a guarantee here.

For a production judge, send submissions to a separate service. The API should authenticate and validate the request, persist only necessary metadata, and submit code to an isolated execution backend (for example, a carefully configured Piston deployment or another hardened runner). Enforce CPU, memory, process, filesystem, network, and wall-clock restrictions outside the browser. Return structured results to the UI; do not execute untrusted submissions in the application origin.

## Future backend checklist

- HTTPS, secure cookies, server-side password KDF, session revocation, and server-side login rate limiting.
- CSRF tokens and origin checks for state-changing cookie-authenticated endpoints.
- Strict Content Security Policy and other security headers.
- Server-side request validation and consistent error responses.
- Isolated Python execution with resource and network controls.
- Structured logs, dependency updates, backups, restore drills, monitoring, and incident procedures.
