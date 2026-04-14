export function formatDate(iso, withTime = false) {
  const opts = { year: "numeric", month: "2-digit", day: "2-digit" };
  if (withTime) {
    opts.hour = "2-digit";
    opts.minute = "2-digit";
  }
  return new Date(iso).toLocaleString("zh-CN", opts);
}

export const STATUS_LABELS = {
  pending: "待开始",
  outline_drafted: "Outline 草稿",
  outline_confirmed: "Outline 已确认",
  draft_completed: "正文完成",
  fact_check_passed: "核查通过",
  needs_repair: "需修复",
  needs_repair_manual: "需人工修复",
  done: "已完成",
};

export function switchStage(stage, stageButtons, stagePanels, outputTitle, stageLabels) {
  stageButtons.forEach((b) => {
    b.classList.toggle("is-selected", b.dataset.stage === stage);
    b.setAttribute("aria-pressed", String(b.dataset.stage === stage));
  });
  stagePanels.forEach((p) => { p.hidden = p.dataset.stagePanel !== stage; });
  if (outputTitle) outputTitle.textContent = stageLabels?.[stage] || stage;
}
