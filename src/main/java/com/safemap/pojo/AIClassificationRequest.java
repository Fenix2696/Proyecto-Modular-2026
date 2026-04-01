package com.safemap.pojo;

import io.micronaut.serde.annotation.Serdeable;

@Serdeable
public record AIClassificationRequest (String text){}

