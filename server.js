import { startServer } from './src/server.js';

startServer().catch((error) => {
  console.error('Failed to start LoveEssay web server:', error);
  process.exit(1);
});
