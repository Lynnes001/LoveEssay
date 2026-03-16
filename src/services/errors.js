export class TaskCancelledError extends Error {
  constructor(message = '任务已取消') {
    super(message);
    this.name = 'TaskCancelledError';
  }
}

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}
