import { confirmOutline, getOutline, patchOutline } from "/js/api.js";

/**
 * Manages the outline confirmation panel (Step 2).
 * In the new wizard layout, the panel visibility is controlled by the step
 * navigation; pass overrideShowHide: true to skip the panel.hidden toggling.
 */
export function initializeOutlinePanel({
  panel,
  thesisEl,
  introEl,
  sectionsEl,
  conclusionEl,
  mustIncludeEl,
  mustAvoidEl,
  notesEl,
  languageEl,
  saveBtn,
  confirmBtn,
  statusMsg,
  draftButton,
  rawJsonEl,
  onConfirmed,
  overrideShowHide = false,
}) {
  let currentSessionId = null;
  let currentOutlineData = null;

  function show() {
    if (!overrideShowHide && panel) panel.hidden = false;
  }

  function hide() {
    if (!overrideShowHide && panel) panel.hidden = true;
  }

  function setStatus(msg, isError = false) {
    if (statusMsg) {
      statusMsg.textContent = msg;
      statusMsg.style.color = isError ? "var(--failed)" : "var(--muted)";
    }
  }

  function readFormIntoData() {
    if (!currentOutlineData) return null;
    const data = JSON.parse(JSON.stringify(currentOutlineData));
    data.thesis = thesisEl.value.trim();
    if (typeof data.intro === "string") {
      data.intro = introEl.value.trim();
    } else {
      data.intro.direction = introEl.value.trim();
    }
    if (typeof data.conclusion === "string") {
      data.conclusion = conclusionEl.value.trim();
    } else {
      data.conclusion.direction = conclusionEl.value.trim();
    }
    data.controls.must_include = mustIncludeEl.value
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    data.controls.must_avoid = mustAvoidEl.value
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    data.controls.generation_notes = notesEl.value.trim() || null;
    data.controls.target_language = languageEl.value || null;

    const sectionTextareas = sectionsEl.querySelectorAll("textarea[data-section-id]");
    sectionTextareas.forEach((ta) => {
      const sec = data.sections.find((s) => s.id === ta.dataset.sectionId);
      if (sec) sec.claim = ta.value.trim();
    });
    return data;
  }

  function renderOutline(data) {
    currentOutlineData = data;

    if (thesisEl) thesisEl.value = data.thesis || "";
    if (introEl) introEl.value = (typeof data.intro === "string" ? data.intro : data.intro?.direction) || "";
    if (conclusionEl) conclusionEl.value = (typeof data.conclusion === "string" ? data.conclusion : data.conclusion?.direction) || "";
    if (mustIncludeEl) mustIncludeEl.value = (data.controls?.must_include || []).join("\n");
    if (mustAvoidEl) mustAvoidEl.value = (data.controls?.must_avoid || []).join("\n");
    if (notesEl) notesEl.value = data.controls?.generation_notes || "";
    if (languageEl) languageEl.value = data.controls?.target_language || "";

    if (sectionsEl) {
      sectionsEl.innerHTML = "";
      (data.sections || []).forEach((sec, idx) => {
        const wrapper = document.createElement("div");
        wrapper.className = "outline-section-item";
        wrapper.innerHTML = `
          <p class="outline-section-item__label">论点 ${idx + 1}（${sec.id}）</p>
          <label style="gap:4px;">
            <textarea data-section-id="${sec.id}" rows="2">${sec.claim || ""}</textarea>
          </label>
          <p class="outline-section-refs" style="margin:4px 0 0;font-size:0.8rem;color:var(--muted);">
            证据引用: ${(sec.evidence_refs || []).join(", ") || "—"}
          </p>
        `;
        sectionsEl.appendChild(wrapper);
      });
    }

    // Show raw JSON in collapse block
    if (rawJsonEl) {
      rawJsonEl.textContent = JSON.stringify(data, null, 2);
    }
  }

  async function loadOutline(sessionId) {
    setStatus("加载中...");
    try {
      const outline = await getOutline(sessionId);
      renderOutline(outline.data);
      show();
      setStatus("Outline 已加载，可以编辑。");
    } catch (err) {
      setStatus(`加载 outline 失败: ${err.message}`, true);
    }
  }

  saveBtn?.addEventListener("click", async () => {
    if (!currentSessionId) return;
    const data = readFormIntoData();
    if (!data) return;
    saveBtn.disabled = true;
    setStatus("保存中...");
    try {
      const updated = await patchOutline(currentSessionId, data);
      currentOutlineData = updated.data;
      if (rawJsonEl) rawJsonEl.textContent = JSON.stringify(updated.data, null, 2);
      setStatus("已保存。");
    } catch (err) {
      setStatus(`保存失败: ${err.message}`, true);
    } finally {
      saveBtn.disabled = false;
    }
  });

  confirmBtn?.addEventListener("click", async () => {
    if (!currentSessionId) return;
    const data = readFormIntoData();
    if (!data) return;
    if (!data.controls?.target_language) {
      setStatus("请先选择目标语言", true);
      return;
    }
    confirmBtn.disabled = true;
    setStatus("确认中...");
    try {
      await confirmOutline(currentSessionId, data);
      setStatus("Outline 已确认！");
      if (draftButton) draftButton.disabled = false;
      onConfirmed?.();
    } catch (err) {
      setStatus(`确认失败: ${err.message}`, true);
      confirmBtn.disabled = false;
    }
  });

  return {
    load(sessionId) {
      currentSessionId = sessionId;
      return loadOutline(sessionId);
    },
    hide,
    reset() {
      hide();
      currentSessionId = null;
      currentOutlineData = null;
      if (sectionsEl) sectionsEl.innerHTML = "";
      if (thesisEl) thesisEl.value = "";
      if (introEl) introEl.value = "";
      if (conclusionEl) conclusionEl.value = "";
      if (mustIncludeEl) mustIncludeEl.value = "";
      if (mustAvoidEl) mustAvoidEl.value = "";
      if (notesEl) notesEl.value = "";
      if (languageEl) languageEl.value = "";
      if (rawJsonEl) rawJsonEl.textContent = "";
      setStatus("");
      if (confirmBtn) confirmBtn.disabled = false;
    },
  };
}
