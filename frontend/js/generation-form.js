// Explicit state machine for the generation form.
//
// States:
//   idle       — no task running, form is ready
//   submitting — POST in flight, waiting for task_id
//   streaming  — SSE connected, chunks arriving
//   done       — pipeline completed successfully
//   failed     — pipeline or network error

const STATE = {
  IDLE: "idle",
  SUBMITTING: "submitting",
  STREAMING: "streaming",
  DONE: "done",
  FAILED: "failed",
};

export function initializeGenerationForm({
  form,
  taskMeta,
  taskStatus,
  extractionOutput,
  draftOutput,
  rewriteOutput,
  createGenerationTask,
  fetchTask,
  openTaskStream,
}) {
  let state = STATE.IDLE;
  let activeSource = null;
  const submitBtn = form.querySelector("button[type=submit]") || form.querySelector("button");

  function transition(nextState, statusText) {
    state = nextState;
    taskStatus.textContent = statusText ?? nextState;
    submitBtn.disabled = state === STATE.SUBMITTING || state === STATE.STREAMING;
    submitBtn.textContent =
      state === STATE.SUBMITTING || state === STATE.STREAMING ? "生成中…" : "开始生成";
  }

  function closeStream() {
    if (activeSource) {
      activeSource.close();
      activeSource = null;
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    // Ignore double-submits while already running
    if (state === STATE.SUBMITTING || state === STATE.STREAMING) return;

    closeStream();

    extractionOutput.textContent = "";
    draftOutput.textContent = "";
    rewriteOutput.textContent = "";
    taskMeta.textContent = "提交中…";
    transition(STATE.SUBMITTING, "submitting");

    let result;
    try {
      const payload = Object.fromEntries(new FormData(form).entries());
      result = await createGenerationTask(payload);
    } catch (error) {
      taskMeta.textContent = "提交失败";
      transition(STATE.FAILED, `failed · ${error.message}`);
      return;
    }

    taskMeta.textContent = `task #${result.task_id} / session #${result.session_id}`;
    transition(STATE.STREAMING, "pending");

    activeSource = openTaskStream(result.task_id, {
      onStatus: (message) => {
        if (state !== STATE.STREAMING) return;
        taskStatus.textContent = `${message.status}${message.stage ? ` · ${message.stage}` : ""}`;
      },

      onChunk: (message) => {
        if (state !== STATE.STREAMING) return;
        if (message.stage === "extraction") {
          extractionOutput.textContent += message.delta;
        } else if (message.stage === "draft") {
          draftOutput.textContent += message.delta;
        } else if (message.stage === "rewrite") {
          rewriteOutput.textContent += message.delta;
        }
      },

      onError: (message) => {
        closeStream();
        transition(STATE.FAILED, `failed · ${message.message}`);
      },

      onTransportError: () => {
        // SSE transport glitch — don't crash, show reconnecting hint
        // EventSource will auto-reconnect; only surface if we're still streaming
        if (state === STATE.STREAMING) {
          taskStatus.textContent = "reconnecting…";
        }
      },

      onDone: async () => {
        if (state !== STATE.STREAMING) return;
        transition(STATE.DONE, "done");
        try {
          const task = await fetchTask(result.task_id);
          const finalDocument = task.documents.find((d) => d.stage === "rewrite");
          if (finalDocument) {
            rewriteOutput.textContent = finalDocument.content;
          }
        } catch {
          // Non-fatal: streaming already showed the content
        }
      },
    });
  });
}
