package com.safemap.web.rest;

import com.safemap.pojo.AIClassificationRequest;
import com.safemap.pojo.AIClassificationResponse;
import com.safemap.pojo.ClassifiedNews;
import com.safemap.pojo.GNewsArticle;
import com.safemap.pojo.GNewsResponse;
import com.safemap.pojo.NewsResult;
import com.safemap.pojo.SearchQueryParams;
import com.safemap.web.scrapper.GuardiaNocturnaScraper;
import com.safemap.web.scrapper.Scrapper;
import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Get;
import io.micronaut.http.annotation.QueryValue;
import io.micronaut.http.client.exceptions.HttpClientResponseException;
import io.micronaut.json.JsonMapper;
import io.micronaut.scheduling.TaskExecutors;
import io.micronaut.scheduling.annotation.ExecuteOn;
import jakarta.inject.Inject;
import jakarta.validation.Valid;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Controller("/WebSearch")
public class ScrapCaller {

    @Inject
    JsonMapper jsonMapper;

    @Inject
    AIClassifierClient aiClient;

    @Get("/test")
    public String testScrap() {
        return Scrapper.testScrapper();
    }

    @ExecuteOn(TaskExecutors.BLOCKING)
    @Get("/localNews{?params*}")
    public List<ClassifiedNews> getNews(@Valid SearchQueryParams params) {
        String searchQuery = generateSearchQuery(params);
        return searchAndClassify(searchQuery);
    }

    @ExecuteOn(TaskExecutors.BLOCKING)
    @Get("/newsByQuery")
    public List<ClassifiedNews> getNewsByQuery(@QueryValue String query) {
        if (query == null || query.trim().isEmpty()) {
            return new ArrayList<>();
        }
        return searchAndClassify(query.trim());
    }

    @ExecuteOn(TaskExecutors.BLOCKING)
    @Get("/guardiaNocturna")
    public List<ClassifiedNews> getGuardiaNocturna() {
        try {
            List<NewsResult> news = GuardiaNocturnaScraper.fetch();
            return classifyNews(news);
        } catch (Exception e) {
            System.out.println("Error Guardia Nocturna: " + e.getMessage());
            return new ArrayList<>();
        }
    }

    private List<ClassifiedNews> searchAndClassify(String searchQuery) {
        System.out.println("Search query: " + searchQuery);
        List<ClassifiedNews> classifiedNews = new ArrayList<>();

        try {
            String result = Scrapper.search(searchQuery);
            GNewsResponse gNewsResponse = jsonMapper.readValue(result, GNewsResponse.class);

            List<NewsResult> newsList = mapGNewsToNewsResults(gNewsResponse);
            classifiedNews = classifyNews(newsList);

        } catch (IOException e) {
            System.out.println("Search failed with IOException: " + e.getMessage());
        } catch (Exception e) {
            System.out.println("Search failed with Exception: " + e.getMessage());
        }

        return classifiedNews;
    }

    private List<NewsResult> mapGNewsToNewsResults(GNewsResponse response) {
        List<NewsResult> mapped = new ArrayList<>();

        if (response == null || response.getArticles() == null) {
            return mapped;
        }

        for (GNewsArticle article : response.getArticles()) {
            NewsResult item = new NewsResult();

            item.setTitle(article.getTitle());
            item.setSnippet(
                    Optional.ofNullable(article.getDescription())
                            .orElse(Optional.ofNullable(article.getContent()).orElse(""))
            );
            item.setUrl(article.getUrl());
            item.setLastUpdated(article.getPublishedAt());

            if (article.getSource() != null) {
                item.setSource(article.getSource().getName());
            } else {
                item.setSource("GNews");
            }

            mapped.add(item);
        }

        return mapped;
    }

    private List<ClassifiedNews> classifyNews(List<NewsResult> newsList) {
        List<ClassifiedNews> classifiedNews = new ArrayList<>();

        newsList.forEach(newsResult -> {
            ClassifiedNews resultItem = new ClassifiedNews();

            String title = safeText(newsResult.getTitle());
            String snippet = safeText(newsResult.getSnippet());
            String queryBody = "%s, %s".formatted(title, snippet);

            AIClassificationRequest request = new AIClassificationRequest(queryBody);

            resultItem.setTitle(newsResult.getTitle());
            resultItem.setBody(newsResult.getSnippet());
            resultItem.setSource(newsResult.getSource());
            resultItem.setLastUpdated(newsResult.getLastUpdated());
            resultItem.setUrl(newsResult.getUrl());

            try {
                AIClassificationResponse aiResponse = aiClient.classify(request);

                if (aiResponse != null) {
                    resultItem.setType(aiResponse.top_category());
                    resultItem.setConfidence(aiResponse.confidence());
                } else {
                    applyFallbackCategory(resultItem, queryBody);
                }

            } catch (HttpClientResponseException e) {
                System.out.println("Detalles del error de IA: " + e.getResponse().getBody(String.class));
                applyFallbackCategory(resultItem, queryBody);
            } catch (Exception e) {
                System.out.println("Error clasificando noticia: " + e.getMessage());
                applyFallbackCategory(resultItem, queryBody);
            }

            classifiedNews.add(resultItem);
        });

        return classifiedNews;
    }

    private void applyFallbackCategory(ClassifiedNews resultItem, String text) {
        String t = safeText(text).toLowerCase();

        if (
                t.contains("incendio") ||
                        t.contains("forestal") ||
                        t.contains("bomberos") ||
                        t.contains("rescate") ||
                        t.contains("humo")
        ) {
            resultItem.setType("Emergencia");
            resultItem.setConfidence(0.50);
            return;
        }

        if (
                t.contains("choque") ||
                        t.contains("accidente") ||
                        t.contains("volcadura") ||
                        t.contains("colision") ||
                        t.contains("colisión") ||
                        t.contains("impactó") ||
                        t.contains("impacto")
        ) {
            resultItem.setType("Choque");
            resultItem.setConfidence(0.50);
            return;
        }

        if (
                t.contains("asalto") ||
                        t.contains("asaltaron")
        ) {
            resultItem.setType("Asalto");
            resultItem.setConfidence(0.50);
            return;
        }

        if (
                t.contains("cristalazo") ||
                        t.contains("robo") ||
                        t.contains("robo de auto") ||
                        t.contains("robo de vehiculo") ||
                        t.contains("robo de vehículo")
        ) {
            resultItem.setType("Robo");
            resultItem.setConfidence(0.50);
            return;
        }

        if (
                t.contains("arma blanca") ||
                        t.contains("balacera") ||
                        t.contains("homicidio") ||
                        t.contains("disparos") ||
                        t.contains("violencia") ||
                        t.contains("ataque armado")
        ) {
            resultItem.setType("Violencia");
            resultItem.setConfidence(0.50);
            return;
        }

        if (
                t.contains("vandalismo") ||
                        t.contains("destrozos") ||
                        t.contains("daños")
        ) {
            resultItem.setType("Vandalismo");
            resultItem.setConfidence(0.50);
            return;
        }

        resultItem.setType("Otro");
        resultItem.setConfidence(0.20);
    }

    private String generateSearchQuery(SearchQueryParams queryParams) {
        String callePrincipal = queryParams.callePrincipal();
        String ciudad = queryParams.ciudad().orElse("Guadalajara");
        String estado = queryParams.estado().orElse("Jalisco");

        StringBuilder sb = new StringBuilder(ciudad);
        sb.append(" ").append(estado);
        sb.append(" ").append(callePrincipal);

        if (queryParams.calleSecundaria().isPresent()) {
            if (queryParams.calleTerciaria().isPresent()) {
                sb.append(" entre ")
                        .append(queryParams.calleSecundaria().get())
                        .append(" y ")
                        .append(queryParams.calleTerciaria().get());
            } else {
                sb.append(" y ").append(queryParams.calleSecundaria().get());
            }
        }

        return sb.toString().trim();
    }

    private String safeText(String value) {
        return Optional.ofNullable(value).orElse("");
    }
}