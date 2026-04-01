package com.safemap.pojo;

import io.micronaut.core.annotation.Introspected;
import io.micronaut.serde.annotation.SerdeImport;
import jakarta.validation.constraints.NotBlank;

import java.util.Optional;

@SerdeImport(SearchQueryParams.class)

@Introspected
public record SearchQueryParams (
        @NotBlank String callePrincipal,
        Optional<String> calleSecundaria,
        Optional<String> calleTerciaria,
        Optional<String> ciudad,
        Optional<String> estado,
        Optional<String> coordenadas
){
    public SearchQueryParams {
        if (ciudad.isEmpty()){
            ciudad = Optional.of("Guadalajara");
        }
        if (estado.isEmpty()){
            estado = Optional.of("Jalisco");
        }
    }
}
