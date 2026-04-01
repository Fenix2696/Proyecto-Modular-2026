package com.safemap.pojo;

import io.micronaut.serde.annotation.Serdeable;

import java.util.List;

@Serdeable
public class GNewsResponse {

    private Integer totalArticles;
    private List<GNewsArticle> articles;

    public Integer getTotalArticles() {
        return totalArticles;
    }

    public void setTotalArticles(Integer totalArticles) {
        this.totalArticles = totalArticles;
    }

    public List<GNewsArticle> getArticles() {
        return articles;
    }

    public void setArticles(List<GNewsArticle> articles) {
        this.articles = articles;
    }
}