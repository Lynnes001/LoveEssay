import { completeSession, createFactCheckTask, createRepairTask, getFactCheckReport } from "/js/api.js";
import { openTaskStream } from "/js/stream.js";

/**
 * Renders fact check issues into a <ul> element.
 */
function renderIssues(issuesEl, issues) {
  if (!issuesEl) return;
  issuesEl.innerHTML = "";
  issues.forEach((issue) => {
    const li = document.createElement("li");
    li.className = "fact-issue-item";
    li.innerHTML = `
      <p class="fact-issue-item__type">${issue.type} · <span style="opacity:0.7">${issue.severity}</span></p>
      <p class="fact-issue-item__desc">${issue.evidence}</p>
      <p class="fact-issue-item__fix">建议修复：${issue.suggested_fix}</p>
    `;
    issuesEl.appendChild(li);
  });
}

/**
 * initializeFactCheckPanel wires up the fact-check report panel UI (Step 4).
 */
export function initializeFactCheckPanel({
  panel,
  passSection,
  failSection,
  manualSection,
  issuesEl,
  manualIssuesEl,
  completeBtn,
  repairBtn,
  skipCompleteBtn,
  manualCompleteBtn,
  statusMsg,
  skipSection,           // legacy — not used in wizard layout
  skipFactCheckBtn,      // in footer-s3
  factCheckButton,       // in footer-s4
  repairAttemptLabel,    // optional label showing "第 N/2 次修复"
  stageStatusNodes,
  taskStatus,
  taskStage,
  taskMeta,
  factCheckOutput,
  repairOutput,
  fcStreamCollapse,      // <details> wrapping factCheckOutput
  repairStreamCollapse,  // <details> wrapping repairOutput
  fcIdleSection,         // idle state card in step 4
  onDone,
}) {
  let sessionId = null;

  function setStatus(msg) {
    if (statusMsg) statusMsg.textContent = msg;
  }

  function showPanel() {
    if (panel && panel.hidden !== undefined) panel.hidden = false;
  }

  function hidePanel() {
    if (panel && panel.hidden !== undefined) panel.hidden = true;
  }

  function showSection(which) {
    if (fcIdleSection) fcIdleSection.hidden = which !== "idle";
    if (passSection) passSection.hidden = which !== "pass";
    if (failSection) failSection.hidden = which !== "fail";
    if (manualSection) manualSection.hidden = which !== "manual";
    // Show footer buttons for step 4 appropriately
    if (factCheckButton) factCheckButton.hidden = which !== "idle";
    if (repairBtn) repairBtn.hidden = which !== "fail";
    if (skipCompleteBtn) skipCompleteBtn.hidden = which !== "fail";
    if (completeBtn) completeBtn.hidden = which !== "pass";
    if (manualCompleteBtn) manualCompleteBtn.hidden = which !== "manual";
  }

  async function loadReport(sid) {
    sessionId = sid;
    setStatus("加载中...");
    try {
      const report = await getFactCheckReport(sid);
      renderReport(report);
    } catch (err) {
      setStatus(`加载报告失败: ${err.message}`);
    }
  }

  function renderReport(report) {
    showPanel();
    setStatus("");
    if (report.pass_) {
      showSection("pass");
    } else {
      showSection("fail");
      renderIssues(issuesEl, report.issues || []);
      if (repairAttemptLabel) {
        const attempt = report.repair_attempt || 0;
        repairAttemptLabel.textContent = `第 ${attempt}/2 次修复尝试`;
      }
    }
  }

  function showManual(report) {
    showPanel();
    setStatus("");
    showSection("manual");
    renderIssues(manualIssuesEl, report?.issues || []);
  }

  function onDraftCompleted(sid) {
    sessionId = sid;
    hidePanel();
    showSection("idle");
    // In wizard, the skip button is in footer-s3; enable from there
    setStatus("");
  }

  function reset() {
    hidePanel();
    showSection("idle");
    if (fcStreamCollapse) fcStreamCollapse.hidden = true;
    if (repairStreamCollapse) repairStreamCollapse.hidden = true;
    setStatus("");
    sessionId = null;
    if (factCheckOutput) factCheckOutput.textContent = "";
    if (repairOutput) repairOutput.textContent = "";
  }

  function streamTask(taskResult, opts = {}) {
    const { onComplete } = opts;
    if (taskMeta) taskMeta.textContent = `task #${taskResult.task_id} / session #${taskResult.session_id}`;
    if (taskStatus) taskStatus.textContent = "pending";

    openTaskStream(taskResult.task_id, {
      onStatus: (msg) => {
        if (taskStatus) taskStatus.textContent = `${msg.status}${msg.stage ? ` · ${msg.stage}` : ""}`;
        if (taskStage) {
          taskStage.textContent = msg.stage || "idle";
          taskStage.dataset.stage = msg.stage || "idle";
        }
        if (msg.stage && stageStatusNodes[msg.stage]) {
          stageStatusNodes[msg.stage].textContent = msg.status;
          stageStatusNodes[msg.stage].dataset.state = msg.status;
        }
      },
      onChunk: (msg) => {
        if (msg.stage === "fact_check" && factCheckOutput) {
          factCheckOutput.textContent += msg.delta;
          if (fcStreamCollapse) fcStreamCollapse.hidden = false;
        } else if (msg.stage === "repair" && repairOutput) {
          repairOutput.textContent += msg.delta;
          if (repairStreamCollapse) repairStreamCollapse.hidden = false;
        }
        if (stageStatusNodes[msg.stage]) {
          stageStatusNodes[msg.stage].textContent = "running";
          stageStatusNodes[msg.stage].dataset.state = "running";
        }
      },
      onDone: async () => {
        if (taskStatus) taskStatus.textContent = "done";
        onComplete?.();
      },
      onError: (msg) => {
        setStatus(`任务失败: ${msg.message}`);
        if (taskStatus) taskStatus.textContent = `failed · ${msg.message}`;
      },
    });
  }

  // ── Button handlers ──────────────────────────────────────

  factCheckButton?.addEventListener("click", async () => {
    if (!sessionId) return;
    factCheckButton.disabled = true;
    showSection("idle");
    setStatus("启动事实核查...");
    if (factCheckOutput) factCheckOutput.textContent = "";
    if (fcStreamCollapse) { fcStreamCollapse.hidden = false; fcStreamCollapse.open = true; }

    try {
      const result = await createFactCheckTask(sessionId);
      streamTask(result, {
        onComplete: async () => {
          factCheckButton.disabled = false;
          try {
            const report = await getFactCheckReport(sessionId);
            renderReport(report);
          } catch (err) {
            setStatus(`加载报告失败: ${err.message}`);
          }
        },
      });
    } catch (err) {
      setStatus(`创建任务失败: ${err.message}`);
      factCheckButton.disabled = false;
    }
  });

  repairBtn?.addEventListener("click", async () => {
    if (!sessionId) return;
    repairBtn.disabled = true;
    if (skipCompleteBtn) skipCompleteBtn.disabled = true;
    setStatus("启动修复...");
    if (repairOutput) repairOutput.textContent = "";
    if (factCheckOutput) factCheckOutput.textContent = "";
    if (repairStreamCollapse) { repairStreamCollapse.hidden = false; repairStreamCollapse.open = true; }

    try {
      const result = await createRepairTask(sessionId);
      streamTask(result, {
        onComplete: async () => {
          if (repairBtn) repairBtn.disabled = false;
          if (skipCompleteBtn) skipCompleteBtn.disabled = false;
          try {
            const report = await getFactCheckReport(sessionId);
            if (report.pass_) {
              renderReport(report);
            } else if (report.repair_attempt >= 2) {
              showManual(report);
            } else {
              renderReport(report);
            }
          } catch (err) {
            setStatus(`加载报告失败: ${err.message}`);
          }
        },
      });
    } catch (err) {
      setStatus(`创建修复任务失败: ${err.message}`);
      if (repairBtn) repairBtn.disabled = false;
    }
  });

  async function doComplete(sid) {
    setStatus("完成中...");
    try {
      await completeSession(sid);
      setStatus("文书已完成!");
      onDone?.();
    } catch (err) {
      setStatus(`完成失败: ${err.message}`);
    }
  }

  completeBtn?.addEventListener("click", () => doComplete(sessionId));
  manualCompleteBtn?.addEventListener("click", () => doComplete(sessionId));
  skipCompleteBtn?.addEventListener("click", () => doComplete(sessionId));

  skipFactCheckBtn?.addEventListener("click", async () => {
    if (!sessionId) return;
    skipFactCheckBtn.disabled = true;
    await doComplete(sessionId);
    skipFactCheckBtn.disabled = false;
  });

  return { onDraftCompleted, loadReport, showManual, reset };
}
