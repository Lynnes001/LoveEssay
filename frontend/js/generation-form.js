import { switchStage } from "/js/utils.js";

const STAGES = ["extraction", "outline_draft", "draft", "finetuned", "fact_check", "repair"];

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
  outlineDraftOutput,
  draftOutput,
  rewriteOutput,
  stageButtons = [],
  stagePanels = [],
  stageStatusNodes = {},
  createGenerationTask,
  fetchTask,
  openTaskStream,
  onSessionCreated,
  onOutlineDraftComplete,
  onGenerationDone,
}) {
  let activeSource = null;
  let selectedStage = "extraction";
  const defaultButtonLabel = submitButton?.textContent ?? "生成 Outline";
  const outputNodes = {
    extraction: extractionOutput,
    outline_draft: outlineDraftOutput,
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
    switchStage(stage, stageButtons, stagePanels, outputTitle);
  }
  function clearOutputs() {
    Object.values(outputNodes).forEach((node) => {
      if (node) node.textContent = "";
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

      onSessionCreated?.(result.session_id);

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
        onStageComplete: (message) => {
          if (message.stage === "outline_draft" && message.outline_id) {
            onOutlineDraftComplete?.(result.session_id);
          }
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
        onDone: async (_doneMsg) => {
          setTaskStatusLabel("done");
          setTaskStageLabel("outline_draft");
          STAGES.forEach((stage) => {
            const hasContent = outputNodes[stage]?.textContent;
            setStageState(stage, hasContent ? "done" : stageStatusNodes[stage]?.textContent || "idle");
          });
          setSubmissionState(false);
          closeStream();
          onGenerationDone?.();
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

