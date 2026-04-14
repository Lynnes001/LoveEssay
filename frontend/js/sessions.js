import { formatDate, STATUS_LABELS } from "/js/utils.js";

const listEl = document.querySelector("#session-list");
const newSessionBtn = document.querySelector("#new-session-btn");
const modal = document.querySelector("#new-session-modal");
const nameInput = document.querySelector("#new-session-name");
const studentSelect = document.querySelector("#new-session-student");
const cancelBtn = document.querySelector("#new-session-cancel");
const submitBtn = document.querySelector("#new-session-submit");
const errorEl = document.querySelector("#new-session-error");

function statusLabel(s) {
  return STATUS_LABELS[s] || s;
}

async function loadSessions() {
  try {
    const res = await fetch("/api/sessions");
    if (res.status === 401) { window.location.href = "/login.html"; return; }
    const sessions = await res.json();
    renderSessions(sessions);
  } catch {
    listEl.innerHTML = '<li class="sessions-empty">加载失败，请刷新</li>';
  }
}

function renderSessions(sessions) {
  if (!sessions.length) {
    listEl.innerHTML = '<li class="sessions-empty">暂无 Session，点击"新建 Session"开始</li>';
    return;
  }
  listEl.innerHTML = sessions.map((s) => `
    <li>
      <a class="session-item" href="/editor.html?session_id=${s.id}">
        <div>
          <p class="session-item__name">${s.name}</p>
          <p class="session-item__meta">创建于 ${formatDate(s.created_at, true)}${s.student_id ? " · 有关联学生" : ""}</p>
        </div>
        <span class="session-item__status" data-status="${s.workflow_status}">${statusLabel(s.workflow_status)}</span>
      </a>
    </li>
  `).join("");
}

async function loadStudents() {
  try {
    const res = await fetch("/api/students");
    const students = await res.json();
    students.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = `${s.name}${s.email ? ` (${s.email})` : ""}`;
      studentSelect.appendChild(opt);
    });
  } catch {
    // Students list is optional, ignore error
  }
}

function openModal() {
  nameInput.value = "";
  errorEl.textContent = "";
  modal.hidden = false;
  nameInput.focus();
}

function closeModal() {
  modal.hidden = true;
}

async function createSession() {
  const name = nameInput.value.trim();
  if (!name) {
    errorEl.textContent = "请输入 Session 名称";
    return;
  }
  const studentId = studentSelect.value ? parseInt(studentSelect.value) : null;
  submitBtn.disabled = true;
  errorEl.textContent = "";
  try {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, student_id: studentId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `创建失败 (${res.status})`);
    }
    const session = await res.json();
    window.location.href = `/editor.html?session_id=${session.id}`;
  } catch (err) {
    errorEl.textContent = err.message;
    submitBtn.disabled = false;
  }
}

newSessionBtn.addEventListener("click", openModal);
cancelBtn.addEventListener("click", closeModal);
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
submitBtn.addEventListener("click", createSession);
nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") createSession(); });

Promise.all([loadSessions(), loadStudents()]);
