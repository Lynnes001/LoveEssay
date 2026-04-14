import { initLogout } from "/js/auth.js";
import { createDraftTask, createOutlineTask, fetchTask } from "/js/api.js";
import { initializeFactCheckPanel } from "/js/fact-check.js";
import { initializeGenerationForm } from "/js/generation-form.js";
import { initializeOutlinePanel } from "/js/outline.js";
import { openTaskStream } from "/js/stream.js";

// ── DOM refs ─────────────────────────────────────────────

const form = document.querySelector("#generate-form");
const submitButton = document.querySelector("#generate-button");
const draftButton = document.querySelector("#draft-button");
const taskMeta = document.querySelector("#task-meta");
const taskStatus = document.querySelector("#task-status");
const taskStage = document.querySelector("#task-stage");
const outputTitle = document.querySelector("#output-title");
const extractionOutput = document.querySelector("#extraction-output");
const outlineDraftOutput = document.querySelector("#outline_draft-output");
const draftOutput = document.querySelector("#draft-output");
const rewriteOutput = document.querySelector("#rewrite-output");
const stageButtons = Array.from(document.querySelectorAll(".stage-chip[data-stage]"));
const stagePanels = Array.from(document.querySelectorAll("[data-stage-panel]"));
const stageStatusNodes = {
  extraction: document.querySelector("#stage-extraction-status"),
  outline_draft: document.querySelector("#stage-outline_draft-status"),
  draft: document.querySelector("#stage-draft-status"),
  rewrite: document.querySelector("#stage-rewrite-status"),
  fact_check: document.querySelector("#stage-fact_check-status"),
  repair: document.querySelector("#stage-repair-status"),
};

// ── Outline panel ─────────────────────────────────────────

const outlinePanel = initializeOutlinePanel({
  panel: document.querySelector("#outline-panel"),
  thesisEl: document.querySelector("#outline-thesis"),
  introEl: document.querySelector("#outline-intro"),
  sectionsEl: document.querySelector("#outline-sections"),
  conclusionEl: document.querySelector("#outline-conclusion"),
  mustIncludeEl: document.querySelector("#outline-must-include"),
  mustAvoidEl: document.querySelector("#outline-must-avoid"),
  notesEl: document.querySelector("#outline-notes"),
  languageEl: document.querySelector("#outline-language"),
  saveBtn: document.querySelector("#outline-save-btn"),
  confirmBtn: document.querySelector("#outline-confirm-btn"),
  statusMsg: document.querySelector("#outline-status-msg"),
  draftButton,
  onConfirmed: () => {
    if (draftButton) draftButton.disabled = false;
  },
});

// ── Fact check panel ───────────────────────────────────────

const factCheckPanel = initializeFactCheckPanel({
  panel: document.querySelector("#fact-check-panel"),
  passSection: document.querySelector("#fact-check-pass-section"),
  failSection: document.querySelector("#fact-check-fail-section"),
  manualSection: document.querySelector("#fact-check-manual-section"),
  issuesEl: document.querySelector("#fact-check-issues"),
  manualIssuesEl: document.querySelector("#fact-check-manual-issues"),
  completeBtn: document.querySelector("#complete-btn"),
  repairBtn: document.querySelector("#repair-btn"),
  skipCompleteBtn: document.querySelector("#skip-complete-btn"),
  manualCompleteBtn: document.querySelector("#manual-complete-btn"),
  statusMsg: document.querySelector("#fact-check-status-msg"),
  skipSection: document.querySelector("#skip-section"),
  skipFactCheckBtn: document.querySelector("#skip-fact-check-btn"),
  factCheckButton: document.querySelector("#fact-check-button"),
  stageStatusNodes,
  taskStatus,
  taskStage,
  taskMeta,
  factCheckOutput: document.querySelector("#fact_check-output"),
  repairOutput: document.querySelector("#repair-output"),
  onDone: () => {
    taskStatus.textContent = "done · 文书完成";
  },
});

// ── Generation form (phase 1: outline) ───────────────────

let currentSessionId = null;

initializeGenerationForm({
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
  stageButtons,
  stagePanels,
  stageStatusNodes,
  createGenerationTask: createOutlineTask,
  fetchTask,
  openTaskStream,
  onSessionCreated: (sessionId) => {
    currentSessionId = sessionId;
    draftButton.disabled = true;
    outlinePanel.reset();
    factCheckPanel.reset();
  },
  onOutlineDraftComplete: (sessionId) => {
    outlinePanel.load(sessionId);
  },
});

// ── Draft button (phase 2) ────────────────────────────────

draftButton.addEventListener("click", async () => {
  if (!currentSessionId) return;
  draftButton.disabled = true;
  taskStatus.textContent = "submitting draft";
  try {
    const result = await createDraftTask(currentSessionId);
    taskMeta.textContent = `task #${result.task_id} / session #${result.session_id}`;
    taskStatus.textContent = "pending";
    // reset draft/rewrite outputs
    if (draftOutput) draftOutput.textContent = "";
    if (rewriteOutput) rewriteOutput.textContent = "";

    openTaskStream(result.task_id, {
      onStatus: (message) => {
        taskStatus.textContent = `${message.status}${message.stage ? ` · ${message.stage}` : ""}`;
        if (taskStage) {
          taskStage.textContent = message.stage || "idle";
          taskStage.dataset.stage = message.stage || "idle";
        }
        if (message.stage) {
          stageStatusNodes[message.stage] && (stageStatusNodes[message.stage].textContent = message.status);
        }
      },
      onChunk: (message) => {
        const outputs = { draft: draftOutput, rewrite: rewriteOutput };
        const target = outputs[message.stage];
        if (target) target.textContent += message.delta;
        if (stageStatusNodes[message.stage]) stageStatusNodes[message.stage].textContent = "running";
        // switch view to active stage
        stagePanels.forEach((p) => { p.hidden = p.dataset.stagePanel !== message.stage; });
        stageButtons.forEach((b) => {
          b.classList.toggle("is-selected", b.dataset.stage === message.stage);
          b.setAttribute("aria-pressed", String(b.dataset.stage === message.stage));
        });
        if (outputTitle) outputTitle.textContent = message.stage.charAt(0).toUpperCase() + message.stage.slice(1);
      },
      onDone: async () => {
        taskStatus.textContent = "done";
        ["draft", "rewrite"].forEach((s) => {
          if (stageStatusNodes[s]) stageStatusNodes[s].textContent = "done";
        });
        try {
          const task = await fetchTask(result.task_id);
          const finalDoc = task.documents?.find((d) => d.stage === "rewrite");
          if (finalDoc && rewriteOutput) rewriteOutput.textContent = finalDoc.content;
        } finally {
          // focus rewrite
          stagePanels.forEach((p) => { p.hidden = p.dataset.stagePanel !== "rewrite"; });
          stageButtons.forEach((b) => {
            b.classList.toggle("is-selected", b.dataset.stage === "rewrite");
            b.setAttribute("aria-pressed", String(b.dataset.stage === "rewrite"));
          });
          if (outputTitle) outputTitle.textContent = "Rewrite";
        }
        // Notify fact-check panel that draft is completed
        factCheckPanel.onDraftCompleted(currentSessionId);
      },
      onError: (message) => {
        taskStatus.textContent = `failed · ${message.message}`;
        draftButton.disabled = false;
      },
    });
  } catch (err) {
    taskStatus.textContent = `failed · ${err.message}`;
    draftButton.disabled = false;
  }
});

// ── Sidebar navigation ───────────────────────────────────

const TOOL_CONFIGS = {
  "profile-builder": {
    icon: "👤",
    name: "Profile Builder",
    description: "Build a structured student profile from raw materials — activities, awards, transcripts, and personal statements — so every tool on the platform works from a single source of truth.",
  },
  "school-research": {
    icon: "🏛",
    name: "School Research",
    description: "Research programs, understand what each school values, and map your student's strengths to specific fit factors. Coming soon.",
  },
  "short-answers": {
    icon: "💬",
    name: "Short Answers",
    description: "Generate school-specific supplemental essays and short-answer responses grounded in the student's profile. Coming soon.",
  },
};

const toolEssayWriter = document.querySelector("#tool-essay-writer");
const toolComingSoon = document.querySelector("#tool-coming-soon");
const sidebarItems = document.querySelectorAll(".sidebar-item[data-tool]");

function showEssayWriter() {
  toolEssayWriter.style.display = "";
  toolComingSoon.style.display = "none";
  setActive("essay-writer");
}

function showComingSoon(toolKey) {
  const cfg = TOOL_CONFIGS[toolKey];
  if (!cfg) return;
  toolEssayWriter.style.display = "none";
  toolComingSoon.style.display = "";
  toolComingSoon.innerHTML = `
    <div class="coming-soon-wrap">
      <div class="coming-soon-panel">
        <div class="coming-soon-icon">${cfg.icon}</div>
        <h2>${cfg.name}</h2>
        <p>${cfg.description}</p>
        <span class="coming-soon-tag">Coming Soon</span>
      </div>
    </div>
  `;
  setActive(toolKey);
}

function setActive(toolKey) {
  sidebarItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.tool === toolKey);
  });
}

sidebarItems.forEach((item) => {
  item.addEventListener("click", () => {
    const tool = item.dataset.tool;
    if (tool === "essay-writer") {
      showEssayWriter();
    } else {
      showComingSoon(tool);
    }
  });
});

// ── Logout ───────────────────────────────────────────────

initLogout();

