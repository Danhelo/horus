import { serve } from '@hono/node-server';
import app from './app';
import { env } from './env';

// Initialize database and run migrations on startup
async function initializeDatabase() {
  // Import db to trigger schema initialization
  const { db } = await import('./db');
  console.log('[DB] Database initialized');

  // Schedule periodic cache cleanup (every hour)
  const { neuronpediaService } = await import('./services/neuronpedia');
  setInterval(async () => {
    try {
      const cleaned = await neuronpediaService.cleanupExpiredCache();
      if (cleaned > 0) {
        console.log(`[Cache] Cleaned ${cleaned} expired entries`);
      }
    } catch (error) {
      console.error('[Cache] Cleanup error:', error);
    }
  }, 3600000); // 1 hour

  return db;
}

async function main() {
  try {
    await initializeDatabase();

    console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║   H O R U S   B A C K E N D                       ║
║                                                   ║
║   The Eye Opens...                                ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
`);

    serve({
      fetch: app.fetch,
      port: env.PORT,
    });

    console.log(`[Server] Running on http://localhost:${env.PORT}`);
    console.log(`[Server] Environment: ${env.NODE_ENV}`);
    console.log(`[Server] Health check: http://localhost:${env.PORT}/health`);
  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
}

main();
