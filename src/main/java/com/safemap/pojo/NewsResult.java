package com.safemap.pojo;

import io.micronaut.core.annotation.Introspected;
import io.micronaut.serde.annotation.Serdeable;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Serdeable
@Introspected
@Data
@NoArgsConstructor
@AllArgsConstructor
public class NewsResult {
    private String title;
    private String snippet;
    private String source;
    private String lastUpdated;
    private String url;
    private String scrapingdog_link; // Cambiado a camelCase (estándar Java)
    private String imgSrc;
    private String favicon;
    private String category;
    private String confidence;
}
