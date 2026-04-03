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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class GuardiaNocturnaScraper {

    private static final String BASE_URL = "https://guardianocturna.mx/";
    private static final int CONNECT_TIMEOUT_MS = 8000;
    private static final int READ_TIMEOUT_MS = 8000;
    private static final int MAX_LINES = 900;
    private static final int MAX_CHARS = 120000;

    public static List<NewsResult> fetch() {
        try {
            String html = getHtml(BASE_URL);

            if (html == null || html.isBlank()) {
                System.out.println("Guardia Nocturna: HTML vacio");
                return new ArrayList<>();
            }

            List<NewsResult> parsed = parseLinks(html);
            List<NewsResult> deduped = dedupe(parsed);

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
            news.setLastUpdated(extractDateFromUrl(href));

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
        String dateText = extractDateFromUrl(url);
        return "Nota obtenida de Guardia Nocturna. Titulo: " + title + ". Fecha detectada: " + dateText;
    }

    private static String extractDateFromUrl(String link) {
        if (link == null) return Instant.now().toString();

        java.util.regex.Matcher m = java.util.regex.Pattern
                .compile("https://guardianocturna\\.mx/(\\d{4})/(\\d{2})/(\\d{2})/")
                .matcher(link);

        if (m.find()) {
            int y = Integer.parseInt(m.group(1));
            int mo = Integer.parseInt(m.group(2));
            int d = Integer.parseInt(m.group(3));
            return LocalDate.of(y, mo, d)
                    .atStartOfDay()
                    .toInstant(ZoneOffset.UTC)
                    .toString();
        }

        return Instant.now().toString();
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