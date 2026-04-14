async function apiFetch(url, options = {}) {
  const response = await fetch(url, options);
  if (response.status === 401) {
    window.location.href = "/login.html";
    throw new Error("Not authenticated");
  }
  return response;
}

export async function createOutlineTask(payload) {
  const response = await apiFetch("/api/generate/outline", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Create outline task failed: ${response.status}`);
  }
  return response.json();
}

export async function createDraftTask(sessionId) {
  const response = await apiFetch(`/api/generate/draft?session_id=${sessionId}`, {
    method: "POST",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `Create draft task failed: ${response.status}`);
  }
  return response.json();
}

export async function getOutline(sessionId) {
  const response = await apiFetch(`/api/sessions/${sessionId}/outline`);
  if (!response.ok) {
    throw new Error(`Get outline failed: ${response.status}`);
  }
  return response.json();
}

export async function patchOutline(sessionId, data) {
  const response = await apiFetch(`/api/sessions/${sessionId}/outline`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
  });
  if (!response.ok) {
    throw new Error(`Patch outline failed: ${response.status}`);
  }
  return response.json();
}

export async function confirmOutline(sessionId, data) {
  const response = await apiFetch(`/api/sessions/${sessionId}/outline/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `Confirm outline failed: ${response.status}`);
  }
  return response.json();
}

export async function fetchTask(taskId) {
  const response = await apiFetch(`/api/tasks/${taskId}`);
  if (!response.ok) {
    throw new Error(`Fetch task failed: ${response.status}`);
  }
  return response.json();
}

export async function createFactCheckTask(sessionId) {
  const response = await apiFetch(`/api/generate/fact-check?session_id=${sessionId}`, {
    method: "POST",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `Create fact-check task failed: ${response.status}`);
  }
  return response.json();
}

export async function createRepairTask(sessionId) {
  const response = await apiFetch(`/api/generate/repair?session_id=${sessionId}`, {
    method: "POST",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `Create repair task failed: ${response.status}`);
  }
  return response.json();
}

export async function createFinetuneTask(sessionId) {
  const response = await apiFetch(`/api/generate/finetune?session_id=${sessionId}`, {
    method: "POST",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `Create finetune task failed: ${response.status}`);
  }
  return response.json();
}

export async function getFactCheckReport(sessionId) {
  const response = await apiFetch(`/api/sessions/${sessionId}/fact-check-report`);
  if (!response.ok) {
    throw new Error(`Get fact check report failed: ${response.status}`);
  }
  return response.json();
}

export async function completeSession(sessionId) {
  const response = await apiFetch(`/api/sessions/${sessionId}/complete`, {
    method: "POST",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `Complete session failed: ${response.status}`);
  }
  return response.json();
}

export async function getSession(sessionId) {
  const response = await apiFetch(`/api/sessions/${sessionId}`);
  if (!response.ok) {
    throw new Error(`Get session failed: ${response.status}`);
  }
  return response.json();
}

export async function patchSession(sessionId, data) {
  const response = await apiFetch(`/api/sessions/${sessionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `Patch session failed: ${response.status}`);
  }
  return response.json();
}

export async function getStudent(studentId) {
  const response = await apiFetch(`/api/students/${studentId}`);
  if (!response.ok) {
    throw new Error(`Get student failed: ${response.status}`);
  }
  return response.json();
}

export async function listDocuments(sessionId) {
  const response = await apiFetch(`/api/sessions/${sessionId}/documents`);
  if (!response.ok) {
    throw new Error(`List documents failed: ${response.status}`);
  }
  return response.json();
}

export async function getDocument(documentId) {
  const response = await apiFetch(`/api/documents/${documentId}`);
  if (!response.ok) {
    throw new Error(`Get document failed: ${response.status}`);
  }
  return response.json();
}

export async function listStudents() {
  const response = await apiFetch("/api/students");
  if (!response.ok) {
    throw new Error(`List students failed: ${response.status}`);
  }
  return response.json();
}

export async function createStudent(data) {
  const response = await apiFetch("/api/students", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `Create student failed: ${response.status}`);
  }
  return response.json();
}

export async function patchStudent(studentId, data) {
  const response = await apiFetch(`/api/students/${studentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `Patch student failed: ${response.status}`);
  }
  return response.json();
}
