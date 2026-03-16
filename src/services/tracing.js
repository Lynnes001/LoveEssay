import { Client } from 'langsmith';
import { traceable } from 'langsmith/traceable';

export const langSmithClient = new Client();

export function createTraceable(fn, options = {}) {
  return traceable(fn, {
    client: langSmithClient,
    ...options
  });
}

export async function flushTraces() {
  try {
    await langSmithClient.flush();
  } catch (error) {
    console.warn('Failed to flush LangSmith traces:', error?.message || error);
  }
}
