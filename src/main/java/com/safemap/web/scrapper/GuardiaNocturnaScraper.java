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

    public static List<NewsResult> fetch() {
        try {
            String html = getHtml(BASE_URL);
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
        URL url = new URL(urlStr);
        HttpURLConnection con = (HttpURLConnection) url.openConnection();

        con.setRequestMethod("GET");
        con.setConnectTimeout(15000);
        con.setReadTimeout(15000);

        con.setRequestProperty(
                "User-Agent",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        );
        con.setRequestProperty("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
        con.setRequestProperty("Accept-Language", "es-MX,es;q=0.9,en;q=0.8");
        con.setRequestProperty("Referer", BASE_URL);

        int status = con.getResponseCode();
        System.out.println("Guardia Nocturna status: " + status);

        BufferedReader reader = new BufferedReader(
                new InputStreamReader(con.getInputStream(), StandardCharsets.UTF_8)
        );

        StringBuilder html = new StringBuilder();
        String line;

        while ((line = reader.readLine()) != null) {
            html.append(line).append("\n");
        }

        reader.close();
        con.disconnect();

        return html.toString();
    }

    private static List<NewsResult> parseLinks(String html) {
        List<NewsResult> results = new ArrayList<>();

        if (html == null || html.isBlank()) return results;

        java.util.regex.Pattern p = java.util.regex.Pattern.compile(
                "(?is)<a[^>]+href\\s*=\\s*\"([^\"]+)\"[^>]*>(.*?)</a>"
        );

        java.util.regex.Matcher m = p.matcher(html);

        while (m.find()) {
            String rawHref = m.group(1);
            String rawText = m.group(2);

            String href = toAbsoluteUrl(rawHref);
            String title = clean(rawText);

            if (href == null || href.isBlank()) continue;
            if (!looksLikeRealPost(href)) continue;
            if (title == null || title.isBlank()) continue;
            if (title.length() < 15) continue;

            NewsResult news = new NewsResult();
            news.setTitle(title);
            news.setUrl(href);
            news.setSource("Guardia Nocturna");
            news.setSnippet("");
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

        // excluir categorias, tags, home, redes, paginas auxiliares
        if (l.equals("https://guardianocturna.mx/")) return false;
        if (l.contains("/category/")) return false;
        if (l.contains("/tag/")) return false;
        if (l.contains("/page/")) return false;
        if (l.contains("/wp-content/")) return false;
        if (l.contains("/feed")) return false;
        if (l.contains("/author/")) return false;
        if (l.contains("/contacto")) return false;
        if (l.contains("/aviso")) return false;
        if (l.contains("/anunciate")) return false;
        if (l.contains("/nosotros")) return false;

        // si tiene fecha en la url, casi seguro es post real
        if (l.matches("https://guardianocturna\\.mx/\\d{4}/\\d{2}/\\d{2}/.+")) return true;

        // aceptar slugs largos
        String path = l.replace("https://guardianocturna.mx/", "");
        return path.length() > 20 && path.split("/").length >= 1;
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
            return LocalDate.of(y, mo, d).atStartOfDay().toInstant(ZoneOffset.UTC).toString();
        }

        return Instant.now().toString();
    }

    private static List<NewsResult> dedupe(List<NewsResult> input) {
        Map<String, NewsResult> unique = new LinkedHashMap<>();

        for (NewsResult n : input) {
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
                .replaceAll("\\s+", " ")
                .trim();
    }
}