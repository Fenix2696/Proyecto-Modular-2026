# Plan tecnico para mejorar el scrapper de noticias de incidentes

> Contexto actual: el scraping vive principalmente en `src/main/java/com/safemap/web/scrapper` y se orquesta desde `ScrapCaller` (`/WebSearch`).

## 1) Objetivo principal

Aumentar cobertura de noticias utiles para mapa sin degradar precision:
- **+40%** de notas candidatas por dia.
- **+25%** de notas geolocalizables.
- Mantener **duplicados < 15%** tras dedupe.

## 2) Diagnostico rapido del estado actual

### Fortalezas
- Ya existe integracion con GNews (`Scrapper.search`) y fuente local (`GuardiaNocturnaScraper.fetch`).
- Hay paso de clasificacion IA y fallback por reglas.

### Limitantes observadas
- Query unica y estatica por llamada; no hay expansion por sinonimos/zona.
- GNews limitado a `max=10` y luego recortado (`MAX_GNEWS_RESULTS=8`).
- Guardia Nocturna solo toma homepage y extrae anchors; falta profundizar en secciones/paginacion.
- Dedupe simple por URL; no hay dedupe semantico por evento.
- No hay pipeline explicito de scoring (relevancia, confianza de fuente, frescura).

## 3) Arquitectura objetivo (incremental)

### 3.1 Nuevo flujo de ingesta (pipeline)
1. **Query Planning**
   - generar N queries por categoria x zona x ventana temporal.
2. **Fetch multi-fuente**
   - GNews por lotes + scraper local por secciones.
3. **Normalizacion**
   - modelo comun `NewsResult` enriquecido con metadata (query origen, hash texto, score fuente).
4. **Dedupe**
   - URL canonica + similitud de titulo/snippet.
5. **Clasificacion y scoring**
   - IA + reglas + score final para mapa.
6. **Geoparsing/geocoding**
   - extraer entidades de ubicacion y resolver coordenadas.
7. **Persistencia y entrega**
   - guardar para consultas de mapa y evitar reprocesar.

## 4) Cambios tecnicos por modulo

## 4.1 `Scrapper.java` (GNews)

### Cambios
- Implementar metodo nuevo `searchBatch(List<String> queries, SearchWindow window)`.
- Permitir paginacion controlada (si API lo soporta) y aumentar `max` configurable.
- Agregar `retry` con backoff para errores 429/5xx.
- Parametrizar `lang/country/from/max` por configuracion.

### Resultado esperado
- Mayor recall por lote de queries sin romper limites de la API.

## 4.2 `GuardiaNocturnaScraper.java`

### Cambios
- Extraer tambien links desde secciones relevantes (`/categoria/...`) y primeras paginas.
- Añadir parser por bloques de noticia (no solo regex de `<a>` global).
- Enriquecer `NewsResult` con:
  - `sourceSection`
  - `publishedHint`
  - `contentHash`
- Agregar `crawlDepth` configurable (1-2 niveles maximo).

### Resultado esperado
- Mas notas locales y mejor calidad de parseo.

## 4.3 `ScrapCaller.java`

### Cambios
- Crear servicio nuevo `SearchPlannerService` para construir queries dinamicas.
- Fusionar resultados GNews + locales con `MergeAndRankService`.
- Sustituir limites fijos por configurables (`application.properties`):
  - `scraper.max.gnews.results`
  - `scraper.max.local.results`
  - `scraper.max.classify`
- Exponer endpoint de diagnostico:
  - `/WebSearch/debug/metrics` (captura, dedupe, clasificacion, geolocalizacion).

### Resultado esperado
- Pipeline medible y ajustable sin recompilar.

## 4.4 Clasificacion y reglas

### Cambios
- Separar reglas fallback en clase dedicada `IncidentRuleClassifier`.
- Expandir diccionario por categoria (sinonimos regionales).
- Añadir score combinado:
  - `score = 0.35*sourceReliability + 0.25*freshness + 0.25*classificationConfidence + 0.15*queryMatch`

### Resultado esperado
- Mejor precision para lo que realmente debe ir al mapa.

## 4.5 Geolocalizacion (nuevo componente)

### Cambios
- Crear `GeoExtractionService`:
  - NER basico por patrones (colonia, avenida, cruce, municipio).
  - resolucion por geocoder con cache.
- Guardar nivel de precision:
  - `EXACT_ADDRESS`, `STREET`, `COLONIA`, `MUNICIPIO`, `UNKNOWN`.

### Resultado esperado
- Mas eventos representables en mapa aunque no tengan direccion exacta.

## 5) Data model sugerido (minimo)

Agregar a entidad de noticia/evento campos:
- `query_origin`
- `canonical_url`
- `content_hash`
- `relevance_score`
- `geo_precision`
- `dedupe_group_id`

## 6) Plan por sprints (4 semanas)

## Sprint 1 (Base de coverage)
- `SearchPlannerService` + expansion de queries.
- Config externa de limites.
- Logging estructurado por query/fuente.

**Criterio de aceptacion**: +20% capturas vs baseline.

## Sprint 2 (Dedupe + ranking)
- URL canonica + hash semantico liviano.
- `MergeAndRankService`.

**Criterio de aceptacion**: duplicados < 20%.

## Sprint 3 (Geolocalizacion)
- `GeoExtractionService` + cache geocoder.
- Campos `geo_precision` y fallback por municipio.

**Criterio de aceptacion**: +20% notas con coordenada util para mapa.

## Sprint 4 (Hardening y observabilidad)
- Endpoint `/debug/metrics`.
- Alertas por caida de cobertura por fuente.
- Ajuste fino de pesos de score.

**Criterio de aceptacion**: estabilidad 7 dias, sin regresiones criticas.

## 7) KPIs a monitorear

- `captured_total`
- `classified_incident_rate`
- `geo_resolved_rate`
- `dedupe_rate`
- `median_ingest_latency`
- `source_distribution`

## 8) Riesgos y mitigacion

- **Rate limit API externa** -> backoff + cache + rotacion de queries.
- **Ruido por expansion agresiva** -> ranking + umbral minimo de score.
- **Costos de geocoding** -> cache persistente + fallback por nivel geografico.

## 9) Primeros tickets recomendados (accionables)

1. Crear `SearchPlannerService` con diccionarios por categoria.
2. Refactor de `ScrapCaller` para usar planner + merge centralizado.
3. Implementar dedupe URL canonica + hash de titulo/snippet.
4. Crear `GeoExtractionService` con precision levels.
5. Exponer endpoint de metricas de pipeline.

---

Si te parece bien, el siguiente paso es bajar esto a **issues tecnicos concretos** (con esfuerzo estimado y dependencias) para arrancar implementacion.
