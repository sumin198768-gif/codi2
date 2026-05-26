// Patch os.hostname() to return ASCII-only string for Vercel CLI
const os = require('os');
const orig = os.hostname.bind(os);
os.hostname = function() {
  return orig().replace(/[^\x00-\x7F]/g, 'X');
};
