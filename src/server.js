import { app } from './app.js';
import { config } from './config.js';
import { ensureUploadDir } from './services/uploads.js';
import { healthcheckDb } from './db/pool.js';
import { healthcheckRedis } from './services/queue.js';

export async function startServer() {
  await ensureUploadDir();
  await Promise.all([healthcheckDb(), healthcheckRedis()]);

  return new Promise((resolve) => {
    const server = app.listen(config.port, '0.0.0.0', () => {
      console.log(`LoveEssay web running on 0.0.0.0:${config.port}`);
      resolve(server);
    });
  });
}
