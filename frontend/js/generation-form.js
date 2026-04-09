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
  let activeSource = null;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (activeSource) {
      activeSource.close();
      activeSource = null;
    }

    extractionOutput.textContent = "";
    draftOutput.textContent = "";
    rewriteOutput.textContent = "";
    taskStatus.textContent = "submitting";

    try {
      const payload = Object.fromEntries(new FormData(form).entries());
      const result = await createGenerationTask(payload);

      taskMeta.textContent = `task #${result.task_id} / session #${result.session_id}`;
      taskStatus.textContent = "pending";

      activeSource = openTaskStream(result.task_id, {
        onStatus: (message) => {
          taskStatus.textContent = `${message.status}${message.stage ? ` · ${message.stage}` : ""}`;
        },
        onChunk: (message) => {
          if (message.stage === "extraction") {
            extractionOutput.textContent += message.delta;
          } else if (message.stage === "draft") {
            draftOutput.textContent += message.delta;
          } else if (message.stage === "rewrite") {
            rewriteOutput.textContent += message.delta;
          }
        },
        onError: (message) => {
          taskStatus.textContent = `failed · ${message.message}`;
        },
        onTransportError: () => {
          taskStatus.textContent = "reconnecting";
        },
        onDone: async () => {
          taskStatus.textContent = "done";
          const task = await fetchTask(result.task_id);
          const finalDocument = task.documents.find((document) => document.stage === "rewrite");
          if (finalDocument) {
            rewriteOutput.textContent = finalDocument.content;
          }
        },
      });
    } catch (error) {
      taskMeta.textContent = "提交失败";
      taskStatus.textContent = `failed · ${error.message}`;
    }
  });
}
