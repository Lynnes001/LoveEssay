export function openTaskStream(taskId, handlers) {
  const source = new EventSource(`/api/stream/${taskId}`);

  source.addEventListener("status", (event) => {
    handlers.onStatus?.(JSON.parse(event.data));
  });

  source.addEventListener("chunk", (event) => {
    handlers.onChunk?.(JSON.parse(event.data));
  });

  source.addEventListener("stage_complete", (event) => {
    handlers.onStageComplete?.(JSON.parse(event.data));
  });

  source.addEventListener("task_error", (event) => {
    handlers.onError?.(event.data ? JSON.parse(event.data) : { message: "Unknown SSE error" });
    source.close();
  });

  source.onerror = () => {
    handlers.onTransportError?.();
  };

  source.addEventListener("done", (event) => {
    handlers.onDone?.(JSON.parse(event.data));
    source.close();
  });

  return source;
}
