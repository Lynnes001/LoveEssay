import IORedis from 'ioredis';
import { Queue } from 'bullmq';
import { config } from '../config.js';

const sharedConnectionOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
  retryStrategy(times) {
    return Math.min(times * 200, 2000);
  }
};

let redisConnection = null;
let taskQueue = null;

export function createRedisConnection() {
  return new IORedis(config.redisUrl, sharedConnectionOptions);
}

function getRedisConnection() {
  if (!redisConnection) {
    redisConnection = createRedisConnection();
  }
  return redisConnection;
}

function getTaskQueue() {
  if (!taskQueue) {
    taskQueue = new Queue(config.queueName, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: 100,
        removeOnFail: 100
      }
    });
  }
  return taskQueue;
}

export async function enqueueTask(taskId) {
  await getTaskQueue().add(
    'generate-essay',
    { taskId },
    {
      jobId: taskId
    }
  );
}

export async function cancelQueuedJob(taskId) {
  const job = await getTaskQueue().getJob(taskId);
  if (!job) {
    return false;
  }

  const state = await job.getState();
  if (['waiting', 'delayed', 'prioritized'].includes(state)) {
    await job.remove();
    return true;
  }

  return false;
}

export async function healthcheckRedis() {
  const connection = getRedisConnection();
  if (connection.status === 'wait') {
    await connection.connect();
  }
  await connection.ping();
}
