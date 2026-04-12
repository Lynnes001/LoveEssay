import { createGenerationTask, fetchTask } from "/js/api.js";
import { initializeGenerationForm } from "/js/generation-form.js";
import { openTaskStream } from "/js/stream.js";

// ── Generation form ──────────────────────────────────────

const form = document.querySelector("#generate-form");
const submitButton = document.querySelector("#generate-button");
const taskMeta = document.querySelector("#task-meta");
const taskStatus = document.querySelector("#task-status");
const taskStage = document.querySelector("#task-stage");
const outputTitle = document.querySelector("#output-title");
const extractionOutput = document.querySelector("#extraction-output");
const draftOutput = document.querySelector("#draft-output");
const rewriteOutput = document.querySelector("#rewrite-output");
const stageButtons = Array.from(document.querySelectorAll(".stage-chip[data-stage]"));
const stagePanels = Array.from(document.querySelectorAll("[data-stage-panel]"));
const stageStatusNodes = {
  extraction: document.querySelector("#stage-extraction-status"),
  draft: document.querySelector("#stage-draft-status"),
  rewrite: document.querySelector("#stage-rewrite-status"),
};

initializeGenerationForm({
  form,
  submitButton,
  taskMeta,
  taskStatus,
  taskStage,
  outputTitle,
  extractionOutput,
  draftOutput,
  rewriteOutput,
  stageButtons,
  stagePanels,
  stageStatusNodes,
  createGenerationTask,
  fetchTask,
  openTaskStream,
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

document.querySelector("#logout-btn")?.addEventListener("click", async () => {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    // Best-effort
  }
  window.location.href = "/login.html";
});
