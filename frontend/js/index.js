import { createGenerationTask, fetchTask } from "/js/api.js";
import { initializeGenerationForm } from "/js/generation-form.js";
import { openTaskStream } from "/js/stream.js";

const form = document.querySelector("#generate-form");
const taskMeta = document.querySelector("#task-meta");
const taskStatus = document.querySelector("#task-status");
const extractionOutput = document.querySelector("#extraction-output");
const draftOutput = document.querySelector("#draft-output");
const rewriteOutput = document.querySelector("#rewrite-output");

initializeGenerationForm({
  form,
  taskMeta,
  taskStatus,
  extractionOutput,
  draftOutput,
  rewriteOutput,
  createGenerationTask,
  fetchTask,
  openTaskStream,
});
