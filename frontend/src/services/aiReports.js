import http from "./http";

export async function getActiveAIReports(limit = 50) {
  const response = await http.get("/ai-reports", {
    params: { limit },
  });

  return response.data;
}

export async function syncAIReports(force = false) {
  const response = await http.post(
    "/ai-reports/sync",
    {},
    {
      params: { force },
    }
  );

  return response.data;
}