import { Pool } from 'pg';
import { config } from '../config.js';

export const pool = new Pool({
  connectionString: config.databaseUrl
});

export async function query(text, params = []) {
  return pool.query(text, params);
}

export async function healthcheckDb() {
  await query('SELECT 1');
}
