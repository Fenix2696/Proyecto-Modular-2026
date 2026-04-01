package com.safemap.pojo;

import io.micronaut.core.annotation.Introspected;
import io.micronaut.serde.annotation.Serdeable;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Serdeable
@Introspected
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ScrappingDogPagination {
    String current;
    Map<String, String> page_no2;
}
