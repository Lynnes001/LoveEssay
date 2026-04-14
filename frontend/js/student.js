import { initLogout } from "/js/auth.js";
import { createStudent, getStudent, listStudents, patchStudent } from "/js/api.js";
import { formatDate } from "/js/utils.js";

const listEl = document.querySelector("#student-list");
const newStudentBtn = document.querySelector("#new-student-btn");
const modal = document.querySelector("#student-modal");
const modalTitle = document.querySelector("#student-modal-title");
const nameInput = document.querySelector("#student-name");
const emailInput = document.querySelector("#student-email");
const profileInput = document.querySelector("#student-profile");
const cancelBtn = document.querySelector("#student-modal-cancel");
const submitBtn = document.querySelector("#student-modal-submit");
const errorEl = document.querySelector("#student-modal-error");

let editingStudentId = null;

async function loadStudents() {
  try {
    const students = await listStudents();
    renderStudents(students);
  } catch {
    listEl.innerHTML = '<li class="students-empty">加载失败，请刷新</li>';
  }
}

function renderStudents(students) {
  if (!students.length) {
    listEl.innerHTML = '<li class="students-empty">暂无学生，点击"新建学生"添加</li>';
    return;
  }
  listEl.innerHTML = students.map((s) => `
    <li class="student-item" data-id="${s.id}">
      <div>
        <p class="student-item__name">${s.name}</p>
        <p class="student-item__meta">${s.email || "无邮箱"} · 创建于 ${formatDate(s.created_at)}</p>
      </div>
      <div class="student-item__actions">
        <button class="btn-secondary" data-edit="${s.id}">编辑</button>
      </div>
    </li>
  `).join("");

  listEl.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openEditModal(parseInt(btn.dataset.edit));
    });
  });
}

function openCreateModal() {
  editingStudentId = null;
  modalTitle.textContent = "新建学生";
  nameInput.value = "";
  emailInput.value = "";
  profileInput.value = "";
  errorEl.textContent = "";
  modal.hidden = false;
  nameInput.focus();
}

async function openEditModal(studentId) {
  editingStudentId = studentId;
  modalTitle.textContent = "编辑学生";
  nameInput.value = "";
  emailInput.value = "";
  profileInput.value = "";
  errorEl.textContent = "加载中...";

  try {
    const student = await getStudent(studentId);
    nameInput.value = student.name;
    emailInput.value = student.email || "";
    profileInput.value = student.profile_json ? JSON.stringify(student.profile_json, null, 2) : "";
    errorEl.textContent = "";
    modal.hidden = false;
    nameInput.focus();
  } catch (err) {
    errorEl.textContent = `加载学生数据失败: ${err.message}`;
    modal.hidden = false;
  }
}

function closeModal() {
  modal.hidden = true;
}

async function saveStudent() {
  const name = nameInput.value.trim();
  if (!name) {
    errorEl.textContent = "请输入学生姓名";
    return;
  }

  let profileJson = null;
  const profileRaw = profileInput.value.trim();
  if (profileRaw) {
    try {
      profileJson = JSON.parse(profileRaw);
    } catch {
      errorEl.textContent = "profile_json 格式错误，请输入有效 JSON";
      return;
    }
  }

  submitBtn.disabled = true;
  errorEl.textContent = "";

  const body = { name, email: emailInput.value.trim() || null, profile_json: profileJson };

  try {
    if (editingStudentId) {
      await patchStudent(editingStudentId, body);
    } else {
      await createStudent(body);
    }
    closeModal();
    loadStudents();
  } catch (err) {
    errorEl.textContent = err.message;
  } finally {
    submitBtn.disabled = false;
  }
}

newStudentBtn.addEventListener("click", openCreateModal);
cancelBtn.addEventListener("click", closeModal);
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
submitBtn.addEventListener("click", saveStudent);
nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") saveStudent(); });

loadStudents();

// ── Logout ───────────────────────────────────────────────

initLogout();
