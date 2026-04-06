import test from "node:test";
import assert from "node:assert/strict";

function createElement() {
  return {
    textContent: "",
    listeners: new Map(),
    addEventListener(type, handler) {
      this.listeners.set(type, handler);
    },
  };
}

test("shows failed status when task creation rejects", async () => {
  const form = createElement();
  const taskMeta = createElement();
  const taskStatus = createElement();
  const extractionOutput = createElement();
  const draftOutput = createElement();
  const rewriteOutput = createElement();

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

  const { initializeGenerationForm } = await import("./generation-form.js");

  initializeGenerationForm({
    form,
    taskMeta,
    taskStatus,
    extractionOutput,
    draftOutput,
    rewriteOutput,
    createGenerationTask: async () => {
      throw new Error("Create task failed: 500");
    },
    fetchTask: async () => ({ documents: [] }),
    openTaskStream: () => {
      throw new Error("stream should not open after create failure");
    },
  });

  const submit = form.listeners.get("submit");
  await submit({
    preventDefault() {},
  });

  assert.equal(taskMeta.textContent, "提交失败");
  assert.equal(taskStatus.textContent, "failed · Create task failed: 500");
  assert.equal(extractionOutput.textContent, "");
  assert.equal(draftOutput.textContent, "");
  assert.equal(rewriteOutput.textContent, "");
});
