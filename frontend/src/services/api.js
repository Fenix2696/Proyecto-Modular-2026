import http from "./http";

// INCIDENTES
export async function getAllIncidents() {
  const { data } = await http.get("/incidents");
  return data;
}

export async function createIncident(payload) {
  const { data } = await http.post("/incidents", payload);
  return data;
}

export async function getIncidentById(id) {
  const { data } = await http.get(`/incidents/${id}`);
  return data;
}

export async function deleteIncident(id) {
  const { data } = await http.delete(`/incidents/${id}`);
  return data;
}
