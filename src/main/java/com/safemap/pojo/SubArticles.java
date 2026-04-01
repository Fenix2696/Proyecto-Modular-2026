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
public class SubArticles {
    String name;
    List<NewsResult> news_results = new ArrayList<>();
}
