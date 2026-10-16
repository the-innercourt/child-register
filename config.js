// The ONLY settings in the website. 'api' is your Cloudflare Worker address, NOT your Apps Script URL.
// It is fine for this to be public: the Worker accepts only one locked-down request from this site.
// needsCode: set to true if you set REGISTRATION_CODE in the Worker (parents must then type the code).
window.PORTAL_CONFIG = {
  api: 'https://church-register.seamiragu.workers.dev/',
  needsCode: false
};