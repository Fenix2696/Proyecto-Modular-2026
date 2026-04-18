package com.safemap.web.scrapper;

import com.safemap.pojo.NewsResult;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class GuardiaNocturnaScraper {

    private static final String BASE_URL = "https://guardianocturna.mx/";
    private static final int CONNECT_TIMEOUT_MS = 8000;
    private static final int READ_TIMEOUT_MS = 8000;
    private static final int MAX_LINES = 3000;
    private static final int MAX_CHARS = 450000;
    private static final int MAX_SECTIONS = 14;
    private static final int MAX_SECTION_PAGES = 2;

    public static List<NewsResult> fetch() {
        try {
            String homeHtml = getHtml(BASE_URL);

            if (homeHtml == null || homeHtml.isBlank()) {
                System.out.println("Guardia Nocturna: HTML vacio");
                return new ArrayList<>();
            }

            List<NewsResult> parsed = new ArrayList<>();
            parsed.addAll(parseLinks(homeHtml));

            List<String> sections = parseSectionUrls(homeHtml);
            System.out.println("Guardia Nocturna sections detectadas: " + sections.size());

            for (String sectionUrl : sections) {
                for (int page = 1; page <= MAX_SECTION_PAGES; page++) {
                    String pagedUrl = buildPagedSectionUrl(sectionUrl, page);
                    try {
                        String sectionHtml = getHtml(pagedUrl);
                        if (sectionHtml == null || sectionHtml.isBlank()) continue;
                        parsed.addAll(parseLinks(sectionHtml));
                    } catch (Exception e) {
                        System.out.println("Guardia Nocturna skip section/page: " + pagedUrl + " -> " + e.getMessage());
                    }
                }
            }

            List<NewsResult> deduped = dedupe(parsed);
            deduped.sort(
                    Comparator.comparing(
                                    (NewsResult n) -> safeInstant(n != null ? n.getLastUpdated() : null))
                            .reversed()
            );

            System.out.println("Guardia Nocturna parsed items: " + parsed.size());
            System.out.println("Guardia Nocturna final unique: " + deduped.size());

            return deduped;
        } catch (Exception e) {
            System.out.println("Error Guardia Nocturna: " + e.getMessage());
            return new ArrayList<>();
        }
    }

    private static String getHtml(String urlStr) throws Exception {
        HttpURLConnection con = null;
        BufferedReader reader = null;

        try {
            URL url = new URL(urlStr);
            con = (HttpURLConnection) url.openConnection();

            con.setRequestMethod("GET");
            con.setInstanceFollowRedirects(true);
            con.setConnectTimeout(CONNECT_TIMEOUT_MS);
            con.setReadTimeout(READ_TIMEOUT_MS);

            con.setRequestProperty(
                    "User-Agent",
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            );
            con.setRequestProperty("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
            con.setRequestProperty("Accept-Language", "es-MX,es;q=0.9,en;q=0.8");
            con.setRequestProperty("Referer", BASE_URL);
            con.setRequestProperty("Cache-Control", "no-cache");
            con.setRequestProperty("Pragma", "no-cache");

            int status = con.getResponseCode();
            System.out.println("Guardia Nocturna status: " + status);

            if (status < 200 || status >= 300) {
                throw new RuntimeException("HTTP status " + status);
            }

            reader = new BufferedReader(
                    new InputStreamReader(con.getInputStream(), StandardCharsets.UTF_8)
            );

            StringBuilder html = new StringBuilder();
            String line;
            int lineCount = 0;

            while ((line = reader.readLine()) != null) {
                html.append(line).append("\n");
                lineCount++;

                if (lineCount >= MAX_LINES) {
                    System.out.println("Guardia Nocturna: se alcanzo limite de lineas");
                    break;
                }

                if (html.length() >= MAX_CHARS) {
                    System.out.println("Guardia Nocturna: se alcanzo limite de caracteres");
                    break;
                }
            }

            return html.toString();
        } finally {
            try {
                if (reader != null) reader.close();
            } catch (Exception ignored) {
            }

            if (con != null) {
                con.disconnect();
            }
        }
    }

    private static List<NewsResult> parseLinks(String html) {
        List<NewsResult> results = new ArrayList<>();

        if (html == null || html.isBlank()) return results;

        String safeHtml = html;
        if (safeHtml.length() > MAX_CHARS) {
            safeHtml = safeHtml.substring(0, MAX_CHARS);
        }

        java.util.regex.Pattern p = java.util.regex.Pattern.compile(
                "(?is)<a[^>]+href\\s*=\\s*\"([^\"]+)\"[^>]*>(.*?)</a>"
        );

        java.util.regex.Matcher m = p.matcher(safeHtml);

        while (m.find()) {
            String rawHref = m.group(1);
            String rawText = m.group(2);

            String href = toAbsoluteUrl(rawHref);
            String title = clean(rawText);

            if (href == null || href.isBlank()) continue;
            if (!looksLikeRealPost(href)) continue;
            if (title == null || title.isBlank()) continue;
            if (title.length() < 20) continue;
            if (looksLikeGarbageTitle(title)) continue;

            NewsResult news = new NewsResult();
            news.setTitle(title);
            news.setUrl(href);
            news.setSource("Guardia Nocturna");
            news.setSnippet(buildSnippet(title, href));
            news.setLastUpdated(resolvePublishedDate(href, title));

            results.add(news);
        }

        return results;
    }

    private static String toAbsoluteUrl(String href) {
        if (href == null || href.isBlank()) return null;

        String h = href.trim();

        if (h.startsWith("https://guardianocturna.mx/")) return h;

        if (h.startsWith("http://guardianocturna.mx/")) {
            return h.replace("http://", "https://");
        }

        if (h.startsWith("//guardianocturna.mx/")) {
            return "https:" + h;
        }

        if (h.startsWith("/")) {
            return "https://guardianocturna.mx" + h;
        }

        if (!h.startsWith("http")) {
            return "https://guardianocturna.mx/" + h;
        }

        return null;
    }

    private static boolean looksLikeRealPost(String link) {
        if (link == null || link.isBlank()) return false;

        String l = link.toLowerCase();

        if (!l.startsWith("https://guardianocturna.mx/")) return false;

        if (l.equals("https://guardianocturna.mx/")) return false;
        if (l.contains("/category/")) return false;
        if (l.contains("/tag/")) return false;
        if (l.contains("/page/")) return false;
        if (l.contains("/wp-content/")) return false;
        if (l.contains("/wp-json/")) return false;
        if (l.contains("/feed")) return false;
        if (l.contains("/author/")) return false;
        if (l.contains("/contacto")) return false;
        if (l.contains("/aviso")) return false;
        if (l.contains("/anunciate")) return false;
        if (l.contains("/nosotros")) return false;
        if (l.contains("/cdn-cgi/")) return false;
        if (l.contains("#")) return false;
        if (l.endsWith(".jpg") || l.endsWith(".jpeg") || l.endsWith(".png") || l.endsWith(".webp")) return false;

        if (l.matches("https://guardianocturna\\.mx/\\d{4}/\\d{2}/\\d{2}/.+")) return true;

        String path = l.replace("https://guardianocturna.mx/", "");
        return path.length() > 24 && path.split("/").length >= 1;
    }

    private static boolean looksLikeGarbageTitle(String title) {
        String t = title.toLowerCase();

        if (t.equals("leer mas")) return true;
        if (t.equals("read more")) return true;
        if (t.equals("facebook")) return true;
        if (t.equals("instagram")) return true;
        if (t.equals("twitter")) return true;
        if (t.equals("x")) return true;
        if (t.equals("youtube")) return true;
        if (t.contains("whatsapp")) return true;
        if (t.contains("anunciate")) return true;
        if (t.contains("contacto")) return true;
        if (t.contains("nosotros")) return true;

        return false;
    }

    private static String buildSnippet(String title, String url) {
        String dateText = resolvePublishedDate(url, title);
        return "Nota obtenida de Guardia Nocturna. Titulo: " + title + ". Fecha detectada: " + dateText;
    }

    private static String resolvePublishedDate(String link, String title) {
        String fromUrl = extractDateFromUrl(link);
        if (fromUrl != null && !fromUrl.isBlank()) return fromUrl;

        String fromTitle = extractDateFromTitle(title);
        if (fromTitle != null && !fromTitle.isBlank()) return fromTitle;

        return Instant.EPOCH.toString();
    }

    private static String extractDateFromUrl(String link) {
        if (link == null) return null;

        java.util.regex.Matcher dayMatcher = java.util.regex.Pattern
                .compile("https://guardianocturna\\.mx/(\\d{4})/(\\d{2})/(\\d{2})/")
                .matcher(link);

        if (dayMatcher.find()) {
            int y = Integer.parseInt(dayMatcher.group(1));
            int mo = Integer.parseInt(dayMatcher.group(2));
            int d = Integer.parseInt(dayMatcher.group(3));
            return LocalDate.of(y, mo, d)
                    .atStartOfDay()
                    .toInstant(ZoneOffset.UTC)
                    .toString();
        }

        java.util.regex.Matcher monthMatcher = java.util.regex.Pattern
                .compile("https://guardianocturna\\.mx/(\\d{4})/(\\d{2})/.+")
                .matcher(link);

        if (monthMatcher.find()) {
            int y = Integer.parseInt(monthMatcher.group(1));
            int mo = Integer.parseInt(monthMatcher.group(2));
            return LocalDate.of(y, mo, 1)
                    .atStartOfDay()
                    .toInstant(ZoneOffset.UTC)
                    .toString();
        }

        return null;
    }

    private static String extractDateFromTitle(String title) {
        if (title == null || title.isBlank()) return null;

        String normalized = title
                .toLowerCase()
                .replace("á", "a")
                .replace("é", "e")
                .replace("í", "i")
                .replace("ó", "o")
                .replace("ú", "u");

        java.util.regex.Matcher m = java.util.regex.Pattern
                .compile("(\\d{1,2})\\s+de\\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\\s+del?\\s+(\\d{4})")
                .matcher(normalized);

        if (!m.find()) return null;

        int day = Integer.parseInt(m.group(1));
        int year = Integer.parseInt(m.group(3));
        int month = monthFromSpanish(m.group(2));
        if (month <= 0) return null;

        try {
            return LocalDate.of(year, month, day)
                    .atStartOfDay()
                    .toInstant(ZoneOffset.UTC)
                    .toString();
        } catch (Exception e) {
            return null;
        }
    }

    private static int monthFromSpanish(String name) {
        if (name == null) return -1;
        switch (name) {
            case "enero":
                return 1;
            case "febrero":
                return 2;
            case "marzo":
                return 3;
            case "abril":
                return 4;
            case "mayo":
                return 5;
            case "junio":
                return 6;
            case "julio":
                return 7;
            case "agosto":
                return 8;
            case "septiembre":
            case "setiembre":
                return 9;
            case "octubre":
                return 10;
            case "noviembre":
                return 11;
            case "diciembre":
                return 12;
            default:
                return -1;
        }
    }

    private static List<NewsResult> dedupe(List<NewsResult> input) {
        Map<String, NewsResult> unique = new LinkedHashMap<>();

        for (NewsResult n : input) {
            if (n == null) continue;
            if (n.getUrl() == null || n.getUrl().isBlank()) continue;
            unique.putIfAbsent(n.getUrl(), n);
        }

        return new ArrayList<>(unique.values());
    }

    private static Instant safeInstant(String raw) {
        try {
            if (raw == null || raw.isBlank()) return Instant.EPOCH;
            return Instant.parse(raw);
        } catch (Exception e) {
            return Instant.EPOCH;
        }
    }

    private static List<String> parseSectionUrls(String html) {
        List<String> out = new ArrayList<>();
        if (html == null || html.isBlank()) return out;

        String safeHtml = html.length() > MAX_CHARS ? html.substring(0, MAX_CHARS) : html;
        java.util.regex.Pattern p = java.util.regex.Pattern.compile(
                "(?is)<a[^>]+href\\s*=\\s*\"([^\"]+)\"[^>]*>(.*?)</a>"
        );
        java.util.regex.Matcher m = p.matcher(safeHtml);
        Set<String> seen = new HashSet<>();

        while (m.find() && out.size() < MAX_SECTIONS) {
            String href = toAbsoluteUrl(m.group(1));
            if (href == null) continue;

            String lower = href.toLowerCase();
            if (!lower.startsWith("https://guardianocturna.mx/")) continue;
            if (!lower.contains("/category/")) continue;
            if (lower.contains("/page/")) continue;
            if (lower.endsWith("/category/")) continue;
            if (lower.contains("politica")) continue;
            if (lower.contains("deportes")) continue;

            if (seen.add(lower)) out.add(href);
        }
        return out;
    }

    private static String buildPagedSectionUrl(String sectionUrl, int page) {
        if (sectionUrl == null || sectionUrl.isBlank()) return sectionUrl;
        if (page <= 1) return sectionUrl;
        String base = sectionUrl.endsWith("/") ? sectionUrl.substring(0, sectionUrl.length() - 1) : sectionUrl;
        return base + "/page/" + page + "/";
    }

    private static String clean(String html) {
        if (html == null) return "";

        return html
                .replaceAll("(?is)<script.*?>.*?</script>", " ")
                .replaceAll("(?is)<style.*?>.*?</style>", " ")
                .replaceAll("<[^>]*>", " ")
                .replace("&nbsp;", " ")
                .replace("&amp;", "&")
                .replace("&quot;", "\"")
                .replace("&#8217;", "'")
                .replace("&#8211;", "-")
                .replace("&#8220;", "\"")
                .replace("&#8221;", "\"")
                .replace("&#8230;", "...")
                .replaceAll("\\s+", " ")
                .trim();
    }
}
