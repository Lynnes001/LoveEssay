const STAGES = ["extraction", "draft", "rewrite"];

function toTitleCase(stage) {
  if (!stage) {
    return "Idle";
  }

  return stage.charAt(0).toUpperCase() + stage.slice(1);
}

function parseStatusState(statusText) {
  return statusText.split(" · ")[0];
}

export function initializeGenerationForm({
  form,
  submitButton,
  taskMeta,
  taskStatus,
  taskStage,
  outputTitle,
  extractionOutput,
  draftOutput,
  rewriteOutput,
  stageButtons = [],
  stagePanels = [],
  stageStatusNodes = {},
  createGenerationTask,
  fetchTask,
  openTaskStream,
}) {
  let activeSource = null;
  let selectedStage = "extraction";
  const defaultButtonLabel = submitButton?.textContent ?? "开始生成";
  const outputNodes = {
    extraction: extractionOutput,
    draft: draftOutput,
    rewrite: rewriteOutput,
  };

  function setSubmissionState(isLocked, label = defaultButtonLabel) {
    if (!submitButton) {
      return;
    }

    submitButton.disabled = isLocked;
    submitButton.textContent = label;
  }

  function setTaskStatusLabel(label) {
    taskStatus.textContent = label;
    taskStatus.dataset.state = parseStatusState(label);
  }

  function setTaskStageLabel(stage) {
    const normalizedStage = stage ?? "idle";
    taskStage.textContent = normalizedStage;
    taskStage.dataset.stage = normalizedStage;
  }

  function setStageState(stage, state) {
    const button = stageButtons.find((item) => item.dataset.stage === stage);
    const statusNode = stageStatusNodes[stage];

    if (button) {
      button.dataset.state = state;
    }

    if (statusNode) {
      statusNode.textContent = state;
      statusNode.dataset.state = state;
    }
  }

  function resetStageStates() {
    STAGES.forEach((stage) => setStageState(stage, "idle"));
  }

  function selectStage(stage) {
    if (!STAGES.includes(stage)) {
      return;
    }

    selectedStage = stage;

    stageButtons.forEach((button) => {
      const isSelected = button.dataset.stage === stage;
      button.classList?.toggle?.("is-selected", isSelected);
      button.setAttribute?.("aria-pressed", String(isSelected));
    });

    stagePanels.forEach((panel) => {
      panel.hidden = panel.dataset.stagePanel !== stage;
    });

    if (outputTitle) {
      outputTitle.textContent = toTitleCase(stage);
    }
  }

  function clearOutputs() {
    Object.values(outputNodes).forEach((node) => {
      node.textContent = "";
    });
  }

  function closeStream() {
    if (activeSource) {
      activeSource.close();
      activeSource = null;
    }
  }

  function focusStage(stage) {
    if (!stage) {
      return;
    }

    selectStage(stage);
  }

  stageButtons.forEach((button) => {
    button.addEventListener("click", () => {
      selectStage(button.dataset.stage);
    });
  });

  resetStageStates();
  setTaskStatusLabel(taskStatus?.textContent || "idle");
  setTaskStageLabel(taskStage?.textContent || "idle");
  selectStage(selectedStage);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (submitButton?.disabled) {
      return;
    }

    closeStream();

    setTaskStatusLabel("submitting");
    setTaskStageLabel("idle");
    resetStageStates();
    setSubmissionState(true, "生成中...");

    try {
      const payload = Object.fromEntries(new FormData(form).entries());
      const result = await createGenerationTask(payload);

      clearOutputs();
      taskMeta.textContent = `task #${result.task_id} / session #${result.session_id}`;
      setTaskStatusLabel("pending");
      setStageState("extraction", "pending");
      focusStage("extraction");

      activeSource = openTaskStream(result.task_id, {
        onStatus: (message) => {
          const stage = message.stage ?? "idle";
          setTaskStatusLabel(`${message.status}${message.stage ? ` · ${message.stage}` : ""}`);
          setTaskStageLabel(stage);

          if (message.stage) {
            STAGES.forEach((item) => {
              if (item !== stage && stageStatusNodes[item]?.textContent === "running") {
                setStageState(item, "done");
              }
            });
            setStageState(stage, message.status);
            focusStage(stage);
          }
        },
        onChunk: (message) => {
          const target = outputNodes[message.stage];
          if (!target) {
            return;
          }

          target.textContent += message.delta;
          setStageState(message.stage, "running");
          setTaskStageLabel(message.stage);
          focusStage(message.stage);
        },
        onError: (message) => {
          setTaskStatusLabel(`failed · ${message.message}`);
          const failedStage = taskStage.textContent !== "idle" ? taskStage.textContent : selectedStage;
          if (STAGES.includes(failedStage)) {
            setStageState(failedStage, "failed");
          }
          setSubmissionState(false);
          closeStream();
        },
        onTransportError: () => {
          setTaskStatusLabel("reconnecting");
        },
        onDone: async () => {
          setTaskStatusLabel("done");
          setTaskStageLabel("rewrite");
          STAGES.forEach((stage) => {
            const hasContent = outputNodes[stage]?.textContent;
            setStageState(stage, hasContent ? "done" : stageStatusNodes[stage]?.textContent || "idle");
          });
          try {
            const task = await fetchTask(result.task_id);
            const finalDocument = task.documents.find((document) => document.stage === "rewrite");
            if (finalDocument) {
              rewriteOutput.textContent = finalDocument.content;
            }
          } finally {
            focusStage("rewrite");
            setSubmissionState(false);
            closeStream();
          }
        },
      });
    } catch (error) {
      taskMeta.textContent = "提交失败";
      setTaskStatusLabel(`failed · ${error.message}`);
      setTaskStageLabel("idle");
      setSubmissionState(false);
    }
  });
}
