const form = document.querySelector("#login-form");
const submitBtn = document.querySelector("#login-submit");
const errorEl = document.querySelector("#login-error");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.querySelector("#username").value.trim();
  const password = document.querySelector("#password").value;
  if (!username || !password) {
    errorEl.textContent = "请输入用户名和密码";
    return;
  }
  submitBtn.disabled = true;
  errorEl.textContent = "";
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      errorEl.textContent = data.detail || "登录失败";
      return;
    }
    window.location.href = "/";
  } catch {
    errorEl.textContent = "网络错误，请重试";
  } finally {
    submitBtn.disabled = false;
  }
});
