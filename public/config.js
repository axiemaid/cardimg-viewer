// API base URL — points to the cardimg API server
// Empty string = same origin (works when API is served from same host)
// Set to tunnel URL when frontend is hosted elsewhere (e.g. Vercel)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  window.CARDIMG_API = '';  // same origin (local dev)
} else {
  window.CARDIMG_API = 'https://cardimg.axiemaid.com';
}
