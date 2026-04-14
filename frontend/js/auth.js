export function initLogout() {
  document.querySelector("#logout-btn")?.addEventListener("click", async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Don't block navigation if logout call fails
    }
    window.location.href = "/login.html";
  });
}
