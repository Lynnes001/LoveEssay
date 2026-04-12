import test from "node:test";
import assert from "node:assert/strict";

function createElement(dataset = {}) {
  return {
    textContent: "",
    disabled: false,
    hidden: false,
    dataset: { ...dataset },
    listeners: new Map(),
    attributes: new Map(),
    classList: {
      values: new Set(),
      toggle(name, force) {
        if (force) {
          this.values.add(name);
        } else {
          this.values.delete(name);
        }
      },
      contains(name) {
        return this.values.has(name);
      },
    },
    addEventListener(type, handler) {
      this.listeners.set(type, handler);
    },
    setAttribute(name, value) {
      this.attributes.set(name, value);
    },
    getAttribute(name) {
      return this.attributes.get(name);
    },
  };
}

function createFormContext(overrides = {}) {
  const form = createElement();
  const submitButton = createElement();
  submitButton.textContent = "开始生成";
  const taskMeta = createElement();
  const taskStatus = createElement();
  taskStatus.textContent = "idle";
  const taskStage = createElement();
  taskStage.textContent = "idle";
  const outputTitle = createElement();
  const extractionOutput = createElement();
  const draftOutput = createElement();
  const rewriteOutput = createElement();
  const extractionButton = createElement({ stage: "extraction", state: "idle" });
  const draftButton = createElement({ stage: "draft", state: "idle" });
  const rewriteButton = createElement({ stage: "rewrite", state: "idle" });
  const extractionPanel = createElement({ stagePanel: "extraction" });
  const draftPanel = createElement({ stagePanel: "draft" });
  const rewritePanel = createElement({ stagePanel: "rewrite" });
  draftPanel.hidden = true;
  rewritePanel.hidden = true;
  const stageStatusNodes = {
    extraction: createElement(),
    draft: createElement(),
    rewrite: createElement(),
  };

  return {
    form,
    submitButton,
    taskMeta,
    taskStatus,
    taskStage,
    outputTitle,
    extractionOutput,
    draftOutput,
    rewriteOutput,
    stageButtons: [extractionButton, draftButton, rewriteButton],
    stagePanels: [extractionPanel, draftPanel, rewritePanel],
    stageStatusNodes,
    fetchTask: async () => ({ documents: [] }),
    ...overrides,
  };
}

global.FormData = class FakeFormData {
  constructor() {}

  entries() {
    return [
      ["name", "Test"],
      ["student_background", "Background"],
      ["program", "Program"],
      ["requirements", "Requirements"],
    ][Symbol.iterator]();
  }
};

test("shows failed status when task creation rejects without clearing prior output", async () => {
  const { initializeGenerationForm } = await import("./generation-form.js");
  const context = createFormContext({
    createGenerationTask: async () => {
      throw new Error("Create task failed: 500");
    },
    openTaskStream: () => {
      throw new Error("stream should not open after create failure");
    },
  });

  context.extractionOutput.textContent = "prior extraction";
  context.draftOutput.textContent = "prior draft";
  context.rewriteOutput.textContent = "prior rewrite";

  initializeGenerationForm(context);

  const submit = context.form.listeners.get("submit");
  await submit({
    preventDefault() {},
  });

  assert.equal(context.taskMeta.textContent, "提交失败");
  assert.equal(context.taskStatus.textContent, "failed · Create task failed: 500");
  assert.equal(context.taskStatus.dataset.state, "failed");
  assert.equal(context.extractionOutput.textContent, "prior extraction");
  assert.equal(context.draftOutput.textContent, "prior draft");
  assert.equal(context.rewriteOutput.textContent, "prior rewrite");
});

test("focuses the active stage while streaming and rewrite after completion", async () => {
  const { initializeGenerationForm } = await import("./generation-form.js");
  let streamHandlers;
  const context = createFormContext({
    createGenerationTask: async () => ({ task_id: 3, session_id: 7 }),
    fetchTask: async () => ({
      documents: [{ stage: "rewrite", content: "Final rewrite" }],
    }),
    openTaskStream: (_taskId, handlers) => {
      streamHandlers = handlers;
      return {
        close() {},
      };
    },
  });

  initializeGenerationForm(context);

  const submit = context.form.listeners.get("submit");
  await submit({
    preventDefault() {},
  });

  streamHandlers.onStatus({ status: "running", stage: "draft" });
  streamHandlers.onChunk({ stage: "draft", delta: "Draft body" });

  assert.equal(context.taskStage.textContent, "draft");
  assert.equal(context.outputTitle.textContent, "Draft");
  assert.equal(context.stageButtons[1].getAttribute("aria-pressed"), "true");
  assert.equal(context.stagePanels[1].hidden, false);
  assert.equal(context.stagePanels[0].hidden, true);
  assert.equal(context.draftOutput.textContent, "Draft body");

  await streamHandlers.onDone({});

  assert.equal(context.taskStatus.textContent, "done");
  assert.equal(context.taskStage.textContent, "rewrite");
  assert.equal(context.outputTitle.textContent, "Rewrite");
  assert.equal(context.rewriteOutput.textContent, "Final rewrite");
  assert.equal(context.stageButtons[2].getAttribute("aria-pressed"), "true");
  assert.equal(context.stagePanels[2].hidden, false);
});
