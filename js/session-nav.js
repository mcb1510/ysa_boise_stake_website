// Read the server session; never infer authentication from browser storage.
const button = document.querySelector('[data-session-link]');
let requestId = 0;
async function refreshSession() {
  const currentRequest = ++requestId;
  let signedIn = false;
  try {
    const response = await fetch('/api/me', { credentials: 'same-origin', cache: 'no-store' });
    if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
      signedIn = !!(await response.json()).user;
    }
  } catch { /* Static previews and offline visits retain the sign-in link. */ }
  if (!button || currentRequest !== requestId) return;
  button.textContent = signedIn ? 'Manage Events' : 'Sign In';
  button.setAttribute('aria-label', signedIn ? 'Manage calendar events' : 'Sign in to manage events');
}
window.addEventListener('pageshow', refreshSession);
window.addEventListener('focus', refreshSession);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshSession(); });
refreshSession();
