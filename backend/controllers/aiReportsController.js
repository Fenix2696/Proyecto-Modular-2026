const pool = require("../config/database");
const axios = require("axios");

const JAVA_BASE_URL = (process.env.JAVA_BASE_URL || "http://localhost:8080").replace(/\/+$/, "");
const JAVA_GNEWS_URL = `${JAVA_BASE_URL}/WebSearch/newsByQuery`;
const JAVA_GUARDIA_URL = `${JAVA_BASE_URL}/WebSearch/guardiaNocturna`;
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "";

const AI_REPORT_VISIBLE_HOURS = 12;
const MIN_SYNC_INTERVAL_MINUTES = 20;
const DEFAULT_REPORT_LIMIT = 80;
const MAX_REPORT_LIMIT = 150;

const PRIMARY_SEARCH_QUERIES = [
  "Guadalajara inseguridad",
  "Guadalajara accidente vial",
  "Zapopan inseguridad",
  "Tlajomulco violencia",
  "Jalisco delito",
];

const ZMG_KEYWORDS = [
  "guadalajara",
  "zapopan",
  "tlaquepaque",
  "san pedro tlaquepaque",
  "tlajomulco",
  "tlajomulco de zuniga",
  "tonala",
  "jalisco",
  "el salto",
  "juanacatlan",
  "zmg",
  "oblatos",
  "tetlan",
  "insurgentes",
  "obrera",
  "miravalle",
  "huentitan",
  "periferico",
  "lopez mateos",
  "mariano otero",
  "colon",
];

const ZONE_FALLBACKS = [
  {
    key: "tetlan",
    label: "Tetlan, Guadalajara, Jalisco, Mexico",
    city: "Guadalajara",
    state: "Jalisco",
    lat: 20.6691,
    lng: -103.2994,
  },
  {
    key: "insurgentes",
    label: "Insurgentes, Guadalajara, Jalisco, Mexico",
    city: "Guadalajara",
    state: "Jalisco",
    lat: 20.6489,
    lng: -103.2822,
  },
  {
    key: "obrera",
    label: "Colonia Obrera, Guadalajara, Jalisco, Mexico",
    city: "Guadalajara",
    state: "Jalisco",
    lat: 20.6592,
    lng: -103.3568,
  },
  {
    key: "zapopan",
    label: "Zapopan, Jalisco, Mexico",
    city: "Zapopan",
    state: "Jalisco",
    lat: 20.7236,
    lng: -103.3848,
  },
  {
    key: "tlaquepaque",
    label: "San Pedro Tlaquepaque, Jalisco, Mexico",
    city: "Tlaquepaque",
    state: "Jalisco",
    lat: 20.6409,
    lng: -103.2933,
  },
  {
    key: "tlajomulco",
    label: "Tlajomulco de Zuniga, Jalisco, Mexico",
    city: "Tlajomulco",
    state: "Jalisco",
    lat: 20.4737,
    lng: -103.4479,
  },
  {
    key: "tonala",
    label: "Tonala, Jalisco, Mexico",
    city: "Tonala",
    state: "Jalisco",
    lat: 20.6246,
    lng: -103.2424,
  },
  {
    key: "guadalajara",
    label: "Guadalajara, Jalisco, Mexico",
    city: "Guadalajara",
    state: "Jalisco",
    lat: 20.6597,
    lng: -103.3496,
  },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getDiffDays(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return Infinity;
  return (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
}

function toNullableString(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function toNullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function clampLimit(value, fallback = DEFAULT_REPORT_LIMIT) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(MAX_REPORT_LIMIT, Math.max(1, Math.floor(n)));
}

function extractLatitude(item) {
  return (
    toNullableNumber(item?.latitude) ??
    toNullableNumber(item?.lat) ??
    toNullableNumber(item?.coords?.lat) ??
    null
  );
}

function extractLongitude(item) {
  return (
    toNullableNumber(item?.longitude) ??
    toNullableNumber(item?.lng) ??
    toNullableNumber(item?.lon) ??
    toNullableNumber(item?.coords?.lng) ??
    toNullableNumber(item?.coords?.lon) ??
    null
  );
}

function extractAddressText(item) {
  return (
    toNullableString(item?.address_text) ||
    toNullableString(item?.addressText) ||
    toNullableString(item?.address) ||
    toNullableString(item?.location) ||
    toNullableString(item?.place) ||
    null
  );
}

function extractImageUrl(item) {
  return (
    toNullableString(item?.image_url) ||
    toNullableString(item?.imageUrl) ||
    toNullableString(item?.image) ||
    toNullableString(item?.thumbnail) ||
    toNullableString(item?.thumbnail_url) ||
    toNullableString(item?.thumbnailUrl) ||
    null
  );
}

function containsAny(text, words) {
  const t = String(text || "").toLowerCase();
  return words.some((w) => t.includes(w));
}

function cleanLocationText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/[|]+/g, " ")
    .trim();
}

function normalizeNewsResponse(data) {
  if (Array.isArray(data)) return data;

  // Caso real de GNews: { articles: [...] }
  if (data && Array.isArray(data.articles)) return data.articles;

  // Caso fallback: objeto individual
  if (data && typeof data === "object") return [data];

  return [];
}

function safePreview(data, maxLength = 500) {
  try {
    return JSON.stringify(data).slice(0, maxLength);
  } catch (error) {
    return "[No se pudo serializar respuesta]";
  }
}

function normalizeScraperItem(item) {
  if (!item || typeof item !== "object") return null;

  const sourceObj = item.source && typeof item.source === "object" ? item.source : null;

  return {
    external_id: toNullableString(item.id),
    title: toNullableString(item.title),
    summary:
      toNullableString(item.summary) ||
      toNullableString(item.description) ||
      null,
    body:
      toNullableString(item.body) ||
      toNullableString(item.content) ||
      toNullableString(item.description) ||
      null,
    source_name:
      toNullableString(item.source_name) ||
      toNullableString(item.source) ||
      toNullableString(sourceObj?.name) ||
      null,
    source_url:
      toNullableString(item.source_url) ||
      toNullableString(item.url),
    image_url: extractImageUrl(item),
    raw_category:
      toNullableString(item.category) ||
      toNullableString(item.type) ||
      null,
    confidence:
      toNullableNumber(item.confidence),
    published_at:
      toNullableString(item.published_at) ||
      toNullableString(item.publishedAt) ||
      toNullableString(item.lastUpdated),
    latitude: extractLatitude(item),
    longitude: extractLongitude(item),
    address_text: extractAddressText(item),
    original: item,
  };
}

function normalizeCategory(cat, text = "") {
  const c = String(cat || "").toLowerCase();
  const t = String(text || "").toLowerCase();

  if (t.includes("cristalazo")) return "cristalazo";

  if (
    c.includes("accidente") ||
    c.includes("choque") ||
    t.includes("accidente") ||
    t.includes("choque") ||
    t.includes("volcadura") ||
    t.includes("carambola")
  ) {
    return "choque";
  }

  if (c.includes("asalto") || t.includes("asalto")) return "asalto";

  if (
    c.includes("robo") ||
    t.includes("robo") ||
    t.includes("despojo")
  ) {
    return "robo";
  }

  if (
    c.includes("violencia") ||
    t.includes("violencia") ||
    t.includes("balacera") ||
    t.includes("homicidio") ||
    t.includes("ataque armado") ||
    t.includes("disparos")
  ) {
    return "violencia";
  }

  if (
    t.includes("incendio") ||
    t.includes("bomberos") ||
    t.includes("explosion") ||
    t.includes("rescate")
  ) {
    return "emergencia";
  }

  if (
    t.includes("extorsion") ||
    t.includes("secuestro") ||
    t.includes("detenido") ||
    t.includes("droga") ||
    t.includes("trata de personas")
  ) {
    return "delito";
  }

  if (t.includes("vandalismo") || t.includes("destrozos")) return "vandalismo";

  return "otro";
}

function isUsefulCategory(category, text = "") {
  if (
    ["asalto", "robo", "cristalazo", "choque", "violencia", "emergencia", "delito", "vandalismo"].includes(category)
  ) {
    return true;
  }

  return containsAny(text, [
    "asalto",
    "robo",
    "cristalazo",
    "balacera",
    "violencia",
    "choque",
    "accidente",
    "volcadura",
    "trafico",
    "caos vial",
    "incendio",
    "bomberos",
    "homicidio",
    "extorsion",
    "secuestro",
    "detenido",
    "droga",
  ]);
}

function looksLikeRegionalNews(item) {
  const text = `${item?.title || ""} ${item?.body || ""}`.toLowerCase();
  const source = String(item?.source_name || "").toLowerCase();

  if (source.includes("guardia nocturna")) return true;
  if (containsAny(text, ZMG_KEYWORDS)) return true;

  const excluded = [
    "chiapas",
    "oaxaca",
    "veracruz",
    "cdmx",
    "ciudad de mexico",
    "monterrey",
    "nuevo leon",
    "sinaloa",
  ];

  if (containsAny(text, excluded)) return false;

  return text.includes("jalisco");
}

function detectZoneFallback(text) {
  const t = String(text || "").toLowerCase();
  return ZONE_FALLBACKS.find((z) => t.includes(z.key)) || null;
}

function extractCandidateQueries(item) {
  const title = cleanLocationText(item?.title || "");
  const body = cleanLocationText(item?.body || "");
  const directAddress = cleanLocationText(item?.address_text || "");
  const zone = detectZoneFallback(`${title} ${body} ${directAddress}`);

  const queries = [];

  if (directAddress) {
    queries.push(`${directAddress}, Guadalajara, Jalisco, Mexico`);
    queries.push(`${directAddress}, Jalisco, Mexico`);
  }

  if (zone?.label) queries.push(zone.label);

  if (title) {
    queries.push(`${title}, Guadalajara, Jalisco, Mexico`);
    queries.push(`${title}, Jalisco, Mexico`);
  }

  if (body) {
    queries.push(`${body.slice(0, 120)}, Guadalajara, Jalisco, Mexico`);
  }

  return [...new Set(queries.filter(Boolean))];
}

function geocodeResultLooksValid(result, zoneHint) {
  const formatted = String(result?.formatted_address || "").toLowerCase();
  const comps = Array.isArray(result?.address_components) ? result.address_components : [];
  const compText = comps.map((c) => `${c.long_name} ${c.short_name}`).join(" ").toLowerCase();
  const allText = `${formatted} ${compText}`;

  if (!(allText.includes("jalisco") || allText.includes("jal."))) return false;

  if (zoneHint?.city && allText.includes(zoneHint.city.toLowerCase())) return true;
  if (containsAny(allText, ZMG_KEYWORDS)) return true;

  return false;
}

async function geocodeAddress(query, zoneHint = null) {
  if (!GOOGLE_MAPS_API_KEY || !query) return null;

  try {
    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/geocode/json",
      {
        params: {
          address: query,
          key: GOOGLE_MAPS_API_KEY,
          region: "mx",
          language: "es",
          components: "country:MX|administrative_area:Jalisco",
        },
        timeout: 12000,
      }
    );

    const results = response?.data?.results;
    if (!Array.isArray(results) || results.length === 0) return null;

    const valid = results.find((r) => geocodeResultLooksValid(r, zoneHint));
    if (!valid?.geometry?.location) return null;

    const lat = toNullableNumber(valid.geometry.location.lat);
    const lng = toNullableNumber(valid.geometry.location.lng);

    if (lat === null || lng === null) return null;

    return {
      latitude: lat,
      longitude: lng,
      address_text: toNullableString(valid.formatted_address) || query,
    };
  } catch (error) {
    console.error("Error geocoding:", query, error.message);
    return null;
  }
}

async function resolveLocationForNews(item) {
  const existingLat = item.latitude;
  const existingLng = item.longitude;
  const existingAddress = item.address_text;

  if (existingLat !== null && existingLng !== null) {
    return {
      latitude: existingLat,
      longitude: existingLng,
      address_text: existingAddress,
      city: null,
      state: "Jalisco",
      source: "payload",
    };
  }

  const fullText = `${item?.title || ""} ${item?.body || ""} ${existingAddress || ""}`;
  const zone = detectZoneFallback(fullText);
  const candidateQueries = extractCandidateQueries(item);

  for (const query of candidateQueries) {
    const geo = await geocodeAddress(query, zone);
    if (geo) {
      return {
        latitude: geo.latitude,
        longitude: geo.longitude,
        address_text: geo.address_text || existingAddress || zone?.label || null,
        city: zone?.city || "Guadalajara",
        state: zone?.state || "Jalisco",
        source: "geocoding",
      };
    }
    await sleep(120);
  }

  if (zone) {
    return {
      latitude: zone.lat,
      longitude: zone.lng,
      address_text: existingAddress || zone.label,
      city: zone.city,
      state: zone.state,
      source: "fallback-zone",
    };
  }

  return {
    latitude: null,
    longitude: null,
    address_text: existingAddress || null,
    city: "Guadalajara",
    state: "Jalisco",
    source: "none",
  };
}

async function fetchGNewsWithQueries(queries) {
  const allResults = [];
  const queryStats = [];

  for (const query of queries) {
    try {
      const response = await axios.get(JAVA_GNEWS_URL, {
        params: { query },
        timeout: 20000,
      });

      const noticias = normalizeNewsResponse(response.data)
        .map(normalizeScraperItem)
        .filter(Boolean);

      console.log("GNews query:", query);
      console.log("GNews raw preview:", safePreview(response.data));
      console.log("GNews normalized count:", noticias.length);

      allResults.push(...noticias);

      queryStats.push({
        source: "GNews",
        query,
        count: noticias.length,
      });

      await sleep(1200);
    } catch (error) {
      console.error("Error GNews:", query, error.message);
      queryStats.push({
        source: "GNews",
        query,
        count: 0,
        error: error.message,
      });
      await sleep(1800);
    }
  }

  return { allResults, queryStats };
}

async function fetchGuardiaNocturna() {
  try {
    const response = await axios.get(JAVA_GUARDIA_URL, {
      timeout: 45000,
    });

    const noticias = normalizeNewsResponse(response.data)
      .map(normalizeScraperItem)
      .filter(Boolean);

    console.log("Guardia raw preview:", safePreview(response.data));
    console.log("Guardia normalized count:", noticias.length);

    return {
      allResults: noticias,
      queryStats: [
        {
          source: "Guardia Nocturna",
          query: "/WebSearch/guardiaNocturna",
          count: noticias.length,
        },
      ],
    };
  } catch (error) {
    console.error("Error Guardia Nocturna:", error.message);
    return {
      allResults: [],
      queryStats: [
        {
          source: "Guardia Nocturna",
          query: "/WebSearch/guardiaNocturna",
          count: 0,
          error: error.message,
        },
      ],
    };
  }
}

async function fetchAllNewsFromJava() {
  const gnews = await fetchGNewsWithQueries(PRIMARY_SEARCH_QUERIES);
  const guardia = await fetchGuardiaNocturna();

  return {
    noticias: [...guardia.allResults, ...gnews.allResults],
    queryStats: [...guardia.queryStats, ...gnews.queryStats],
  };
}

async function expireOldAIReports() {
  await pool.query(`
    UPDATE ai_reports
    SET is_active = FALSE, updated_at = NOW()
    WHERE expires_at <= NOW() AND is_active = TRUE
  `);
}

async function getLastAISyncInfo() {
  const result = await pool.query(`
    SELECT MAX(detected_at) AS last_sync_at
    FROM ai_reports
  `);

  return result.rows?.[0] || { last_sync_at: null };
}

async function shouldSkipExternalSync() {
  const row = await getLastAISyncInfo();

  if (!row?.last_sync_at) {
    return { skip: false, lastSyncAt: null, reason: "No hay sync previo" };
  }

  const lastSyncAt = new Date(row.last_sync_at);
  if (Number.isNaN(lastSyncAt.getTime())) {
    return { skip: false, lastSyncAt: null, reason: "Fecha invalida" };
  }

  const diffMinutes = (Date.now() - lastSyncAt.getTime()) / (1000 * 60);

  if (diffMinutes < MIN_SYNC_INTERVAL_MINUTES) {
    return {
      skip: true,
      lastSyncAt: row.last_sync_at,
      reason: `Sync reciente: ${diffMinutes.toFixed(1)} minutos`,
    };
  }

  return {
    skip: false,
    lastSyncAt: row.last_sync_at,
    reason: `Ultimo sync hace ${diffMinutes.toFixed(1)} minutos`,
  };
}

async function getStoredActiveAIReports(limit = DEFAULT_REPORT_LIMIT) {
  await expireOldAIReports();

  const safeLimit = clampLimit(limit);

  const result = await pool.query(
    `
    SELECT *
    FROM ai_reports
    WHERE is_active = TRUE
      AND expires_at > NOW()
    ORDER BY published_at DESC NULLS LAST, detected_at DESC
    LIMIT $1
    `,
    [safeLimit]
  );

  return result.rows;
}

function selectBestDayWindow(newsItems) {
  const windows = [4, 7, 15];

  for (const days of windows) {
    const filtered = newsItems.filter((n) => {
      const fecha = parseDate(n.published_at);
      const diffDias = getDiffDays(fecha);
      return Number.isFinite(diffDias) && diffDias >= 0 && diffDias <= days;
    });

    if (filtered.length >= 8) {
      return { days, filtered };
    }
  }

  return { days: 15, filtered: newsItems };
}

async function syncAIReports(req, res) {
  try {
    await expireOldAIReports();

    const forceSync = String(req.query.force || "").toLowerCase() === "true";
    const syncCheck = await shouldSkipExternalSync();

    if (!forceSync && syncCheck.skip) {
      const cachedRows = await getStoredActiveAIReports(DEFAULT_REPORT_LIMIT);

      return res.json({
        success: true,
        message: "Sync omitido: usando cache local",
        usedCache: true,
        forceSync: false,
        minSyncMinutes: MIN_SYNC_INTERVAL_MINUTES,
        lastSyncAt: syncCheck.lastSyncAt,
        reason: syncCheck.reason,
        cachedCount: cachedRows.length,
        data: cachedRows,
      });
    }

    const { noticias, queryStats } = await fetchAllNewsFromJava();

    const noticiasValidas = noticias.filter((n) => {
      if (!n?.source_url) return false;
      if (!n?.title && !n?.body) return false;

      const text = `${n.title || ""} ${n.body || ""}`;
      const category = normalizeCategory(n.raw_category, text);

      // Si viene de Guardia Nocturna, ser mas permisivos
      const isGuardia = String(n.source_name || "").toLowerCase().includes("guardia nocturna");

      if (!isGuardia) {
        if (!isUsefulCategory(category, text)) return false;
        if (!looksLikeRegionalNews({ ...n, source_name: n.source_name })) return false;
      }

      const fecha = parseDate(n.published_at);
      const diffDias = getDiffDays(fecha);

      // permitir noticias de hasta 45 dias mientras estabilizamos el flujo
      return Number.isFinite(diffDias) && diffDias >= 0 && diffDias <= 45;
    });

    const { days, filtered } = selectBestDayWindow(noticiasValidas);

    const uniqueByUrl = [];
    const seen = new Set();

    for (const n of filtered) {
      if (!n?.source_url || seen.has(n.source_url)) continue;
      seen.add(n.source_url);
      uniqueByUrl.push(n);
    }

    let inserted = 0;
    let updated = 0;
    let failed = 0;
    let geocoded = 0;
    let fallbackLocated = 0;
    let withoutCoords = 0;
    const errors = [];

    for (const n of uniqueByUrl) {
      try {
        const text = `${n.title || ""} ${n.body || ""}`;
        const category = normalizeCategory(n.raw_category, text);
        const fecha = parseDate(n.published_at);

        if (!fecha) {
          failed++;
          errors.push({
            url: n.source_url,
            reason: "Fecha invalida",
            published_at: n.published_at,
          });
          continue;
        }

        const location = await resolveLocationForNews(n);

        if (location.source === "geocoding") geocoded++;
        else if (location.source === "fallback-zone" || location.source === "payload") fallbackLocated++;
        else withoutCoords++;

        const result = await pool.query(
          `
          INSERT INTO ai_reports
          (
            external_id,
            title,
            summary,
            body,
            category,
            confidence,
            source_name,
            source_url,
            image_url,
            city,
            state,
            address_text,
            latitude,
            longitude,
            published_at,
            detected_at,
            expires_at,
            is_active,
            raw_payload
          )
          VALUES
          (
            $1, $2, $3, $4, $5, $6, $7, $8, $9,
            $10, $11, $12, $13, $14,
            $15, NOW(), NOW() + INTERVAL '${AI_REPORT_VISIBLE_HOURS} hours', TRUE, $16
          )
          ON CONFLICT (source_url)
          DO UPDATE SET
            external_id = EXCLUDED.external_id,
            title = EXCLUDED.title,
            summary = EXCLUDED.summary,
            body = EXCLUDED.body,
            category = EXCLUDED.category,
            confidence = EXCLUDED.confidence,
            source_name = EXCLUDED.source_name,
            image_url = EXCLUDED.image_url,
            city = EXCLUDED.city,
            state = EXCLUDED.state,
            address_text = EXCLUDED.address_text,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            published_at = EXCLUDED.published_at,
            expires_at = NOW() + INTERVAL '${AI_REPORT_VISIBLE_HOURS} hours',
            is_active = TRUE,
            raw_payload = EXCLUDED.raw_payload,
            updated_at = NOW()
          RETURNING (xmax = 0) AS inserted_flag
          `,
          [
            n.external_id,
            n.title,
            n.summary,
            n.body,
            category,
            n.confidence,
            n.source_name,
            n.source_url,
            n.image_url,
            location.city || "Guadalajara",
            location.state || "Jalisco",
            location.address_text,
            location.latitude,
            location.longitude,
            fecha,
            JSON.stringify({
              ...n.original,
              normalized: n,
              location_source: location.source,
            }),
          ]
        );

        const wasInserted = result.rows?.[0]?.inserted_flag === true;
        if (wasInserted) inserted++;
        else updated++;
      } catch (err) {
        failed++;
        console.error("Error insertando noticia:", err.message);
        errors.push({
          url: n?.source_url || null,
          reason: err.message,
          title: n?.title || null,
        });
      }
    }

    await expireOldAIReports();
    const storedRows = await getStoredActiveAIReports(DEFAULT_REPORT_LIMIT);

    return res.json({
      success: true,
      message: "Noticias sincronizadas",
      usedCache: false,
      forceSync,
      minSyncMinutes: MIN_SYNC_INTERVAL_MINUTES,
      fetched: noticias.length,
      valid: noticiasValidas.length,
      selectedWindowDays: days,
      uniqueCandidates: uniqueByUrl.length,
      inserted,
      updated,
      failed,
      geocoded,
      fallbackLocated,
      withoutCoords,
      cachedCount: storedRows.length,
      queryStats,
      sampleErrors: errors.slice(0, 10),
      data: storedRows,
    });
  } catch (error) {
    console.error("Error IA sync:", error.message);
    return res.status(500).json({
      success: false,
      message: "Error al obtener noticias IA",
      detail: error.message,
    });
  }
}

async function getActiveAIReports(req, res) {
  try {
    const limit = clampLimit(req.query.limit, DEFAULT_REPORT_LIMIT);
    const rows = await getStoredActiveAIReports(limit);

    return res.json({
      success: true,
      limit,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error("Error obteniendo AI reports:", error);
    return res.status(500).json({
      success: false,
      message: "Error al obtener reportes IA",
    });
  }
}

module.exports = {
  syncAIReports,
  getActiveAIReports,
};