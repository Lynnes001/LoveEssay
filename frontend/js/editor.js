import { initLogout } from "/js/auth.js?v=8";
import {
  createDraftTask,
  createFinetuneTask,
  createOutlineTask,
  fetchTask,
  getDocument,
  getFactCheckReport,
  getSession,
  getStudent,
  listDocuments,
  patchSession,
} from "/js/api.js?v=8";
import { initializeFactCheckPanel } from "/js/fact-check.js?v=8";
import { initializeGenerationForm } from "/js/generation-form.js?v=8";
import { initializeOutlinePanel } from "/js/outline.js?v=8";
import { openTaskStream } from "/js/stream.js?v=8";
import { formatDate, STATUS_LABELS } from "/js/utils.js?v=8";

// ── URL param ────────────────────────────────────────────────

const params = new URLSearchParams(location.search);
const sessionId = params.get("session_id") ? parseInt(params.get("session_id")) : null;

if (!sessionId) {
  location.href = "/index.html";
  throw new Error("No session_id");
}

// ── DOM refs ─────────────────────────────────────────────────

const sessionNameInput = document.querySelector("#session-name-input");
const sessionStatusBadge = document.querySelector("#session-workflow-status");
const nameSaveMsg = document.querySelector("#name-save-msg");

const form = document.querySelector("#generate-form");
const submitButton = document.querySelector("#generate-button");
const formSessionName = document.querySelector("#form-session-name");
const formStudentBackground = document.querySelector("#form-student-background");

const taskMeta = document.querySelector("#task-meta");
const taskStatus = document.querySelector("#task-status");
const taskStage = document.querySelector("#task-stage");

const extractionOutput = document.querySelector("#extraction-output");
const outlineDraftOutput = document.querySelector("#outline_draft-output");
const draftOutput = document.querySelector("#draft-output");
const fineTunedOutput = document.querySelector("#finetuned-output");

const stageStatusNodes = {
  extraction: document.querySelector("#stage-extraction-status"),
  outline_draft: document.querySelector("#stage-outline_draft-status"),
  draft: document.querySelector("#stage-draft-status"),
  finetuned: document.querySelector("#stage-finetuned-status"),
  fact_check: document.querySelector("#stage-fact_check-status"),
  repair: document.querySelector("#stage-repair-status"),
};

const versionList = document.querySelector("#version-list");
const fineTunedCopyBtn = document.querySelector("#finetuned-copy-btn");
const draftCopyBtn = document.querySelector("#draft-copy-btn");
const fcPassRewrite = document.querySelector("#fc-pass-rewrite");
const fcPassCopyBtn = document.querySelector("#fc-pass-copy-btn");
const outlineRawJson = document.querySelector("#outline-raw-json");
const repairAttemptLabel = document.querySelector("#repair-attempt-label");

// ── Step wizard ──────────────────────────────────────────────

const NUM_STEPS = 5;
const stepItems = Array.from(document.querySelectorAll("#step-progress .step-item[data-step]"));
const stepPanels = Array.from(document.querySelectorAll("#step-content .step-panel[data-step-panel]"));
const footerSteps = {
  1: document.querySelector("#footer-s1"),
  2: document.querySelector("#footer-s2"),
  3: document.querySelector("#footer-s3"),
  4: document.querySelector("#footer-s4"),
  5: document.querySelector("#footer-s5"),
};

let currentStep = 1;
let unlockedUpTo = 1;

function workflowToStep(status) {
  switch (status) {
    case "start":          return 1;
    case "outline_ready":  return 2;
    case "draft_ready":    return 3;
    case "finetuned_ready": return 4;
    case "fact_check_done": return 5;
    case "repaired":       return 5;
    case "done":           return 5;
    default:               return 1;
  }
}

function setUnlockedUpTo(step) {
  unlockedUpTo = Math.max(unlockedUpTo, step);
  stepItems.forEach((item) => {
    const n = parseInt(item.dataset.step);
    item.classList.toggle("is-locked", n > unlockedUpTo);
  });
}

function goToStep(n) {
  if (n < 1 || n > NUM_STEPS || n > unlockedUpTo) return;
  currentStep = n;

  stepItems.forEach((item) => {
    const sn = parseInt(item.dataset.step);
    item.classList.remove("is-active", "is-done");
    if (sn === n) item.classList.add("is-active");
    else if (sn < n && sn <= unlockedUpTo) item.classList.add("is-done");
  });

  stepPanels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.stepPanel === String(n));
  });

  Object.entries(footerSteps).forEach(([k, el]) => {
    if (el) el.hidden = String(k) !== String(n);
  });
}

// Step progress bar click navigation
stepItems.forEach((item) => {
  item.addEventListener("click", () => goToStep(parseInt(item.dataset.step)));
  item.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") goToStep(parseInt(item.dataset.step));
  });
});

// Back buttons
document.querySelector("#s2-back-btn")?.addEventListener("click", () => goToStep(1));
document.querySelector("#s3-back-btn")?.addEventListener("click", () => goToStep(2));
document.querySelector("#s4-back-btn")?.addEventListener("click", () => goToStep(3));
document.querySelector("#s5-back-btn")?.addEventListener("click", () => goToStep(4));

// ── Status badge helper ──────────────────────────────────────

function updateStatusBadge(status) {
  sessionStatusBadge.textContent = STATUS_LABELS[status] || status;
  sessionStatusBadge.dataset.status = status;
}

// ── Session name rename ──────────────────────────────────────

let renameSaveTimer = null;

sessionNameInput?.addEventListener("change", async () => {
  const name = sessionNameInput.value.trim();
  if (!name) return;
  clearTimeout(renameSaveTimer);
  renameSaveTimer = setTimeout(async () => {
    if (nameSaveMsg) nameSaveMsg.textContent = "保存中...";
    try {
      await patchSession(sessionId, { name });
      if (nameSaveMsg) {
        nameSaveMsg.textContent = "已保存";
        setTimeout(() => { nameSaveMsg.textContent = ""; }, 2000);
      }
    } catch {
      if (nameSaveMsg) nameSaveMsg.textContent = "保存失败";
    }
  }, 600);
});

// ── Version list (shows finetuned + repair docs) ─────────────

const STAGE_LABELS = {
  extraction: "Extraction",
  outline_draft: "Outline",
  draft: "Draft",
  finetuned: "Finetune",
  fact_check: "Fact Check",
  repair: "Repair",
};

let activeVersionId = null;
const docContentCache = new Map();

async function loadVersionList() {
  try {
    const docs = await listDocuments(sessionId);
    if (!docs.length) return;
    renderVersionList(docs);
    const preferredDoc = docs.find((d) => d.stage === "finetuned") || docs[0];
    await selectVersion(preferredDoc.id, preferredDoc.stage);
  } catch {
    // Non-critical
  }
}

function renderVersionList(docs) {
  versionList.innerHTML = "";
  docs.forEach((doc) => {
    const li = document.createElement("li");
    li.className = "version-item";
    li.dataset.docId = doc.id;
    li.innerHTML = `
      <span class="version-item__badge">v${doc.version} · ${STAGE_LABELS[doc.stage] || doc.stage}</span>
      <span class="version-item__meta">${formatDate(doc.created_at)}</span>
      <span class="version-item__words">${doc.word_count ?? "—"} 词</span>
      <button class="version-item__copy" type="button" data-doc-id="${doc.id}">复制</button>
    `;
    li.addEventListener("click", (e) => {
      if (e.target.classList.contains("version-item__copy")) return;
      selectVersion(doc.id, doc.stage);
    });
    li.querySelector(".version-item__copy").addEventListener("click", (e) => {
      e.stopPropagation();
      copyVersion(doc.id, e.currentTarget);
    });
    versionList.appendChild(li);
  });
}

async function selectVersion(docId, stage) {
  if (activeVersionId === docId) return;
  versionList.querySelectorAll(".version-item").forEach((el) => {
    el.classList.toggle("active", parseInt(el.dataset.docId) === docId);
  });
  try {
    let doc = docContentCache.get(docId);
    if (!doc) {
      doc = await getDocument(docId);
      docContentCache.set(docId, doc);
    }
    activeVersionId = docId;
    if (stage === "finetuned" || !stage) {
      if (fineTunedOutput) fineTunedOutput.textContent = doc.content || "";
      if (fcPassRewrite) fcPassRewrite.textContent = doc.content || "";
    } else if (stage === "draft" && draftOutput) {
      draftOutput.textContent = doc.content || "";
    }
  } catch {
    // Ignore
  }
}

async function copyVersion(docId, btn) {
  try {
    let doc = docContentCache.get(docId);
    if (!doc) {
      doc = await getDocument(docId);
      docContentCache.set(docId, doc);
    }
    await navigator.clipboard.writeText(doc.content || "");
    btn.textContent = "已复制!";
    btn.classList.add("copied");
    setTimeout(() => { btn.textContent = "复制"; btn.classList.remove("copied"); }, 1500);
  } catch {
    btn.textContent = "失败";
    setTimeout(() => { btn.textContent = "复制"; }, 1500);
  }
}

// ── Copy buttons ──────────────────────────────────────────────

function setupCopyBtn(btn, getTextFn) {
  if (!btn) return;
  btn.addEventListener("click", async () => {
    try {
      const text = getTextFn();
      await navigator.clipboard.writeText(text || "");
      btn.textContent = "已复制!";
      btn.classList.add("copied");
      setTimeout(() => { btn.textContent = "复制"; btn.classList.remove("copied"); }, 1500);
    } catch {
      btn.textContent = "失败";
      setTimeout(() => { btn.textContent = "复制"; }, 1500);
    }
  });
}

setupCopyBtn(draftCopyBtn, () => draftOutput?.textContent);
setupCopyBtn(fineTunedCopyBtn, () => fineTunedOutput?.textContent);
setupCopyBtn(fcPassCopyBtn, () => fcPassRewrite?.textContent);

// ── Outline panel ─────────────────────────────────────────────

let activeSessionId = sessionId;

const outlinePanel = initializeOutlinePanel({
  panel: document.querySelector("#step-content"),
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
  draftButton: null,
  rawJsonEl: outlineRawJson,
  onConfirmed: () => {
    // After confirm, trigger draft generation immediately
    setUnlockedUpTo(3);
    goToStep(3);
    updateStatusBadge("outline_ready");
    runDraftGeneration();
  },
  overrideShowHide: true,
});

// ── Draft generation (Phase 2a) ───────────────────────────────

async function runDraftGeneration() {
  const draftRegenBtn = document.querySelector("#draft-regen-btn");
  const goFinetuneBtn = document.querySelector("#go-finetune-btn");
  if (draftRegenBtn) draftRegenBtn.disabled = true;
  if (goFinetuneBtn) goFinetuneBtn.hidden = true;

  taskStatus.textContent = "submitting draft";
  try {
    const result = await createDraftTask(activeSessionId);
    taskMeta.textContent = `task #${result.task_id} / session #${result.session_id}`;
    taskStatus.textContent = "pending";
    if (draftOutput) draftOutput.textContent = "";

    openTaskStream(result.task_id, {
      onStatus: (message) => {
        taskStatus.textContent = `${message.status}${message.stage ? ` · ${message.stage}` : ""}`;
        if (taskStage) { taskStage.textContent = message.stage || "idle"; taskStage.dataset.stage = message.stage || "idle"; }
        if (message.stage && stageStatusNodes[message.stage]) {
          stageStatusNodes[message.stage].textContent = message.status;
          stageStatusNodes[message.stage].dataset.state = message.status;
        }
      },
      onChunk: (message) => {
        if (message.stage === "draft" && draftOutput) draftOutput.textContent += message.delta;
        if (stageStatusNodes[message.stage]) {
          stageStatusNodes[message.stage].textContent = "running";
          stageStatusNodes[message.stage].dataset.state = "running";
        }
      },
      onDone: async () => {
        taskStatus.textContent = "done";
        if (stageStatusNodes.draft) { stageStatusNodes.draft.textContent = "done"; stageStatusNodes.draft.dataset.state = "done"; }
        updateStatusBadge("draft_ready");
        if (draftRegenBtn) draftRegenBtn.disabled = false;
        if (goFinetuneBtn) goFinetuneBtn.hidden = false;
      },
      onError: (message) => {
        taskStatus.textContent = `failed · ${message.message}`;
        if (draftRegenBtn) draftRegenBtn.disabled = false;
      },
    });
  } catch (err) {
    taskStatus.textContent = `failed · ${err.message}`;
    if (draftRegenBtn) draftRegenBtn.disabled = false;
  }
}

document.querySelector("#draft-regen-btn")?.addEventListener("click", () => runDraftGeneration());

document.querySelector("#go-finetune-btn")?.addEventListener("click", async () => {
  setUnlockedUpTo(4);
  goToStep(4);
  await runFinetuneGeneration();
});

// ── Finetune generation (Phase 2b) ────────────────────────────

async function runFinetuneGeneration() {
  const finetuneRegenBtn = document.querySelector("#finetune-regen-btn");
  const goFcBtn = document.querySelector("#go-fact-check-btn");
  const skipBtn = document.querySelector("#skip-fact-check-btn");
  if (finetuneRegenBtn) finetuneRegenBtn.disabled = true;
  if (goFcBtn) goFcBtn.hidden = true;
  if (skipBtn) skipBtn.hidden = true;

  taskStatus.textContent = "submitting finetune";
  try {
    const result = await createFinetuneTask(activeSessionId);
    taskMeta.textContent = `task #${result.task_id} / session #${result.session_id}`;
    taskStatus.textContent = "pending";
    if (fineTunedOutput) fineTunedOutput.textContent = "";

    openTaskStream(result.task_id, {
      onStatus: (message) => {
        taskStatus.textContent = `${message.status}${message.stage ? ` · ${message.stage}` : ""}`;
        if (taskStage) { taskStage.textContent = message.stage || "idle"; taskStage.dataset.stage = message.stage || "idle"; }
        if (message.stage && stageStatusNodes[message.stage]) {
          stageStatusNodes[message.stage].textContent = message.status;
          stageStatusNodes[message.stage].dataset.state = message.status;
        }
      },
      onChunk: (message) => {
        if (message.stage === "finetuned" && fineTunedOutput) fineTunedOutput.textContent += message.delta;
        if (stageStatusNodes[message.stage]) {
          stageStatusNodes[message.stage].textContent = "running";
          stageStatusNodes[message.stage].dataset.state = "running";
        }
      },
      onDone: async () => {
        taskStatus.textContent = "done";
        if (stageStatusNodes.finetuned) { stageStatusNodes.finetuned.textContent = "done"; stageStatusNodes.finetuned.dataset.state = "done"; }
        updateStatusBadge("finetuned_ready");
        if (finetuneRegenBtn) finetuneRegenBtn.disabled = false;
        if (goFcBtn) goFcBtn.hidden = false;
        if (skipBtn) skipBtn.hidden = false;
        // Sync finetuned content to fc-pass section too
        if (fineTunedOutput && fcPassRewrite) fcPassRewrite.textContent = fineTunedOutput.textContent;
        activeVersionId = null;
        docContentCache.clear();
        loadVersionList();
      },
      onError: (message) => {
        taskStatus.textContent = `failed · ${message.message}`;
        if (finetuneRegenBtn) finetuneRegenBtn.disabled = false;
      },
    });
  } catch (err) {
    taskStatus.textContent = `failed · ${err.message}`;
    if (finetuneRegenBtn) finetuneRegenBtn.disabled = false;
  }
}

document.querySelector("#finetune-regen-btn")?.addEventListener("click", () => runFinetuneGeneration());

document.querySelector("#go-fact-check-btn")?.addEventListener("click", () => {
  setUnlockedUpTo(5);
  goToStep(5);
  factCheckPanel.onDraftCompleted(activeSessionId);
});

// ── Fact check panel ───────────────────────────────────────────

const factCheckPanel = initializeFactCheckPanel({
  panel: { hidden: false },
  passSection: document.querySelector("#fact-check-pass-section"),
  failSection: document.querySelector("#fact-check-fail-section"),
  manualSection: document.querySelector("#fact-check-manual-section"),
  issuesEl: document.querySelector("#fact-check-issues"),
  manualIssuesEl: document.querySelector("#fact-check-manual-issues"),
  completeBtn: document.querySelector("#complete-btn"),
  repairBtn: document.querySelector("#repair-btn"),
  skipCompleteBtn: document.querySelector("#skip-complete-btn"),
  manualCompleteBtn: null,
  statusMsg: document.querySelector("#fact-check-status-msg"),
  skipSection: null,
  skipFactCheckBtn: document.querySelector("#skip-fact-check-btn"),
  factCheckButton: document.querySelector("#fact-check-button"),
  repairAttemptLabel,
  stageStatusNodes,
  taskStatus,
  taskStage,
  taskMeta,
  factCheckOutput: document.querySelector("#fact_check-output"),
  repairOutput: document.querySelector("#repair-output"),
  fcStreamCollapse: document.querySelector("#fc-stream-collapse"),
  repairStreamCollapse: document.querySelector("#repair-stream-collapse"),
  fcIdleSection: document.querySelector("#fc-idle-section"),
  onDone: () => {
    taskStatus.textContent = "done · 文书完成";
    updateStatusBadge("done");
    const s5 = document.querySelector("#step-progress .step-item[data-step='5']");
    if (s5) { s5.classList.remove("is-active"); s5.classList.add("is-done"); }
  },
});

// ── Generation form (Phase 1: outline) ───────────────────────

initializeGenerationForm({
  form,
  submitButton,
  taskMeta,
  taskStatus,
  taskStage,
  outputTitle: null,
  extractionOutput,
  outlineDraftOutput,
  draftOutput: null,
  rewriteOutput: null,
  stageButtons: [],
  stagePanels: [],
  stageStatusNodes,
  createGenerationTask: (payload) => createOutlineTask(payload),
  fetchTask,
  openTaskStream,
  onSessionCreated: (newSessionId) => {
    activeSessionId = newSessionId;
    history.replaceState(null, "", `?session_id=${newSessionId}`);
    const exCollapse = document.querySelector("#s1-extraction-collapse");
    if (exCollapse) exCollapse.open = true;
    outlinePanel.reset();
    factCheckPanel.reset();
    activeVersionId = null;
    docContentCache.clear();
    versionList.innerHTML = '<li class="version-empty">暂无版本</li>';
    // Reset all step unlocks back to 1 for new session
    unlockedUpTo = 1;
    setUnlockedUpTo(1);
  },
  onOutlineDraftComplete: (_sid) => {
    // No-op: handled in onGenerationDone
  },
  onGenerationDone: async () => {
    await outlinePanel.load(activeSessionId);
    setUnlockedUpTo(2);
    const btn = submitButton;
    if (btn && btn.textContent !== "查看 Outline →") {
      btn.textContent = "查看 Outline →";
      btn.classList.remove("btn-primary");
      btn.classList.add("btn-secondary");
      btn.type = "button";
      btn.removeAttribute("form");
      const handler = () => {
        btn.removeEventListener("click", handler);
        goToStep(2);
      };
      btn.addEventListener("click", handler);
    }
  },
});

// ── Load session on mount ─────────────────────────────────────

async function loadSession() {
  if (submitButton) submitButton.disabled = true;
  try {
    const session = await getSession(sessionId);

    if (sessionNameInput) sessionNameInput.value = session.name;
    if (formSessionName) formSessionName.value = session.name;
    updateStatusBadge(session.workflow_status);

    if (session.prompt_payload_json) {
      const payload = session.prompt_payload_json;
      if (payload.student_background && formStudentBackground) formStudentBackground.value = payload.student_background;
      const programEl = form?.querySelector("[name=program]");
      const requirementsEl = form?.querySelector("[name=requirements]");
      if (payload.program && programEl) programEl.value = payload.program;
      if (payload.requirements && requirementsEl) requirementsEl.value = payload.requirements;
    }

    await Promise.all([
      session.student_id
        ? getStudent(session.student_id).then((student) => {
            const bg = formStudentBackground?.value?.trim();
            if (!bg && student.profile_json) {
              const profile = typeof student.profile_json === "string"
                ? JSON.parse(student.profile_json) : student.profile_json;
              if (formStudentBackground) formStudentBackground.value = profile.background || JSON.stringify(profile, null, 2);
            }
          }).catch(() => {})
        : Promise.resolve(),
      loadVersionList(),
    ]);

    const status = session.workflow_status;
    const targetStep = workflowToStep(status);
    setUnlockedUpTo(targetStep);

    // Mark Step 1 pipeline stages as done if we're past outline generation
    const pastOutline = ["outline_ready", "draft_ready", "finetuned_ready", "fact_check_done", "repaired", "done"];
    if (pastOutline.includes(status)) {
      if (stageStatusNodes.extraction) { stageStatusNodes.extraction.textContent = "done"; stageStatusNodes.extraction.dataset.state = "done"; }
      if (stageStatusNodes.outline_draft) { stageStatusNodes.outline_draft.textContent = "done"; stageStatusNodes.outline_draft.dataset.state = "done"; }
      taskStatus.textContent = "done";
      taskStatus.dataset.state = "done";
    }

    if (status === "outline_ready") {
      await outlinePanel.load(sessionId);
      goToStep(2);
      if (submitButton && submitButton.textContent !== "查看 Outline →") {
        submitButton.textContent = "查看 Outline →";
        submitButton.classList.remove("btn-primary");
        submitButton.classList.add("btn-secondary");
        submitButton.type = "button";
        submitButton.removeAttribute("form");
        submitButton.addEventListener("click", function goToOutline() {
          submitButton.removeEventListener("click", goToOutline);
          goToStep(2);
        });
      }
    } else if (status === "draft_ready") {
      outlinePanel.load(sessionId);
      goToStep(3);
      const goFinetuneBtn = document.querySelector("#go-finetune-btn");
      if (goFinetuneBtn) goFinetuneBtn.hidden = false;
      // Load draft content if available
      try {
        const docs = await listDocuments(sessionId);
        const draftDoc = docs.find((d) => d.stage === "draft");
        if (draftDoc && draftOutput) {
          const doc = await getDocument(draftDoc.id);
          draftOutput.textContent = doc.content || "";
          docContentCache.set(draftDoc.id, doc);
        }
      } catch { /* non-critical */ }
    } else if (status === "finetuned_ready") {
      outlinePanel.load(sessionId);
      goToStep(4);
      factCheckPanel.onDraftCompleted(sessionId);
      const goFcBtn = document.querySelector("#go-fact-check-btn");
      const skipBtn = document.querySelector("#skip-fact-check-btn");
      if (goFcBtn) goFcBtn.hidden = false;
      if (skipBtn) skipBtn.hidden = false;
    } else if (["fact_check_done", "repaired"].includes(status)) {
      outlinePanel.load(sessionId);
      goToStep(5);
      try {
        const report = await getFactCheckReport(sessionId);
        if (report) factCheckPanel.loadReport(sessionId);
      } catch {
        factCheckPanel.onDraftCompleted(sessionId);
      }
    } else if (status === "done") {
      outlinePanel.load(sessionId);
      goToStep(5);
      try {
        const report = await getFactCheckReport(sessionId);
        if (report) factCheckPanel.loadReport(sessionId);
      } catch { /* no report, show idle */ }
    } else {
      goToStep(targetStep);
    }
  } catch (err) {
    if (taskMeta) taskMeta.textContent = `加载 session 失败: ${err.message}`;
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

loadSession();

// ── Logout ───────────────────────────────────────────────

initLogout();
