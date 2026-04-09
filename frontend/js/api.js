export async function createGenerationTask(payload) {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Create task failed: ${response.status}`);
  }

  return response.json();
}

export async function fetchTask(taskId) {
  const response = await fetch(`/api/tasks/${taskId}`);
  if (!response.ok) {
    throw new Error(`Fetch task failed: ${response.status}`);
  }
  return response.json();
}
