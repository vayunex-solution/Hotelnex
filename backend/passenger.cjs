// Phusion Passenger entry point for cPanel ES Module support
import('./src/server.js').catch(err => {
  console.error('[Passenger] Failed to dynamically import server.js:', err);
});
