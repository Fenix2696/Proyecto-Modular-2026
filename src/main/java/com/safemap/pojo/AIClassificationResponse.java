package com.safemap.pojo;

import io.micronaut.serde.annotation.Serdeable;

import java.util.Map;

@Serdeable
public record AIClassificationResponse(
        String top_category,
        double confidence,
        Map<String,Double> confidenceList
) {}
