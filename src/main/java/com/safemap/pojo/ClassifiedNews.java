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
public class ClassifiedNews {
    private String title;
    private String body;
    private String source;
    private String lastUpdated;
    private String url;
    private String type;
    private Double confidence;
    private Double coordinates;
}
