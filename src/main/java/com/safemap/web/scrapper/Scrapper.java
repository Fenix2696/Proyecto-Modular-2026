package com.safemap.web.scrapper;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

public class Scrapper {

    public static final String GNEWS_API_KEY = System.getenv("GNEWS_API_KEY");
    private static final String GNEWS_SEARCH_URL = "https://gnews.io/api/v4/search";

    public static String search(String query) throws IOException {
        if (GNEWS_API_KEY == null || GNEWS_API_KEY.isEmpty()) {
            throw new IllegalStateException("GNEWS_API_KEY environment variable is not set");
        }

        try {
            String encodedQuery = URLEncoder.encode(query, StandardCharsets.UTF_8);

            // ultimos 7 dias para priorizar recencia
            String fromDate = Instant.now().minus(7, ChronoUnit.DAYS).toString();

            String apiUrl = String.format(
                    "%s?q=%s&lang=es&country=mx&max=10&sortby=publishedAt&from=%s&apikey=%s",
                    GNEWS_SEARCH_URL,
                    encodedQuery,
                    URLEncoder.encode(fromDate, StandardCharsets.UTF_8),
                    GNEWS_API_KEY
            );

            URL url = new URI(apiUrl).toURL();
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(15000);

            int statusCode = connection.getResponseCode();

            BufferedReader in;
            if (statusCode >= 200 && statusCode < 300) {
                in = new BufferedReader(new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8));
            } else {
                in = new BufferedReader(new InputStreamReader(connection.getErrorStream(), StandardCharsets.UTF_8));
            }

            String inputLine;
            StringBuilder content = new StringBuilder();

            while ((inputLine = in.readLine()) != null) {
                content.append(inputLine);
            }

            in.close();
            connection.disconnect();

            System.out.println("GNews status: " + statusCode);
            System.out.println("GNews query: " + query);
            System.out.println(content);

            if (statusCode < 200 || statusCode >= 300) {
                throw new IOException("GNews error " + statusCode + ": " + content);
            }

            return content.toString();

        } catch (IOException e) {
            throw e;
        } catch (Exception e) {
            throw new IOException("Error calling GNews: " + e.getMessage(), e);
        }
    }

    public static String testScrapper() {
        StringBuilder status = new StringBuilder();
        status.append("GNEWS_API_KEY: ")
                .append(GNEWS_API_KEY != null ? "configured" : "NOT SET")
                .append("\n");
        return status.toString();
    }
}