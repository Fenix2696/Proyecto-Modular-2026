export const TYPE_LABEL = {
  robbery: "Robos/Asaltos",
  accident: "Accidentes",
  emergency: "Emergencias",
  theft: "Hurtos",
  vandalism: "Vandalismo",
};

export const getTimeAgo = (date) => {
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Justo ahora";
  if (min < 60) return `Hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Hace ${h} h`;
  return `Hace ${Math.floor(h / 24)} d`;
};

export const inTimeRange = (date, timeRange) => {
  if (timeRange === "all") return true;

  const diff = Date.now() - date.getTime();
  if (timeRange === "1h") return diff <= 3600000;
  if (timeRange === "24h") return diff <= 86400000;
  if (timeRange === "7d") return diff <= 604800000;

  return true;
};
