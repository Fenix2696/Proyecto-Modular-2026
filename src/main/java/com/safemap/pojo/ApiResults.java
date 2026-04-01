package com.safemap.pojo;

import io.micronaut.core.annotation.Introspected;
import io.micronaut.serde.annotation.Serdeable;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Serdeable
@Introspected
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ApiResults {

    SearchInformation search_information = new SearchInformation();
    List <NewsResult> news_results = new ArrayList<>();
    List <SubArticles> sub_articles = new ArrayList<>();
    Pagintion pagintion = new Pagintion();
    ScrappingDogPagination scrapingdog_pagination = new ScrappingDogPagination();

}
