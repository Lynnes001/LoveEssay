import { Worker } from 'bullmq';
import { pathToFileURL } from 'node:url';
import { config } from './config.js';
import { healthcheckDb } from './db/pool.js';
import { buildTaskFailureDetails } from './services/taskFailure.js';
import { createRedisConnection } from './services/queue.js';
import { createTraceable, flushTraces } from './services/tracing.js';
import {
  appendTaskEvent,
  getTaskRecord,
  markTaskCanceled,
  markTaskCompleted,
  markTaskFailed,
  markTaskRunning
} from './services/taskStore.js';
import { TaskCancelledError } from './services/errors.js';
import { runLoveEssayWorkflow } from './workflow/loveEssayWorkflow.js';

async function rawProcessTask(taskId) {
  const record = await getTaskRecord(taskId);
  if (!record) {
    throw new Error('任务不存在');
  }

  if (record.cancel_requested) {
    await markTaskCanceled(taskId, '任务在执行前已取消');
    return;
  }

  await markTaskRunning(taskId, 'starting');
  await appendTaskEvent(taskId, 'worker', 'info', '任务开始执行');

  const result = await runLoveEssayWorkflow({
    taskId,
    schoolName: record.school_name,
    queryText: record.query,
    notes: record.notes,
    filePath: record.material_file_path
  });

  await markTaskCompleted(taskId, {
    resultText: result.text,
    profile: result.profile,
    metrics: result.metrics
  });
  await appendTaskEvent(taskId, 'worker', 'info', '任务执行完成', result.metrics);
}

const processTask = createTraceable(rawProcessTask, {
  name: 'Process LoveEssay Task',
  run_type: 'chain'
});

export async function startWorker() {
  await healthcheckDb();
  const redisConnection = createRedisConnection();
  if (redisConnection.status === 'wait') {
    await redisConnection.connect();
  }
  await redisConnection.ping();

  const worker = new Worker(
    config.queueName,
    async (job) => {
      await processTask(job.data.taskId);
    },
    {
      connection: redisConnection,
      concurrency: 1
    }
  );

  worker.on('completed', (job) => {
    console.log(`Task ${job.id} completed`);
  });

  worker.on('failed', async (job, error) => {
    if (!job?.data?.taskId) {
      console.error('Worker failed without task id', error);
      return;
    }

    if (error instanceof TaskCancelledError) {
      await markTaskCanceled(job.data.taskId, error.message);
      return;
    }

    const record = await getTaskRecord(job.data.taskId).catch(() => null);
    const failure = buildTaskFailureDetails(error, {
      step: record?.current_step || 'worker',
      current_step: record?.current_step || null,
      eventMessage: '任务执行失败'
    });
    await markTaskFailed(job.data.taskId, failure.publicMessage);
    await appendTaskEvent(job.data.taskId, failure.event.step, failure.event.level, failure.event.message, failure.event.payload);
  });

  console.log(`LoveEssay worker listening on queue "${config.queueName}"`);

  const shutdown = async (signal) => {
    console.log(`Received ${signal}, closing worker...`);
    await worker.close();
    await flushTraces();
    await redisConnection.quit();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    shutdown('SIGINT').catch((error) => {
      console.error('Failed to shutdown worker cleanly:', error);
      process.exit(1);
    });
  });

  process.on('SIGTERM', () => {
    shutdown('SIGTERM').catch((error) => {
      console.error('Failed to shutdown worker cleanly:', error);
      process.exit(1);
    });
  });
}

const entryUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;

if (entryUrl && import.meta.url === entryUrl) {
  startWorker().catch((error) => {
    console.error('Failed to start LoveEssay worker:', error);
    process.exit(1);
  });
}
