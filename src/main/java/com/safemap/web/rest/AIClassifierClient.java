package com.safemap.web.rest;

import com.safemap.pojo.AIClassificationRequest;
import com.safemap.pojo.AIClassificationResponse;
import io.micronaut.http.annotation.Body;
import io.micronaut.http.annotation.Post;
import io.micronaut.http.client.annotation.Client;

@Client("${ai.service.url}")
public interface AIClassifierClient {

    @Post("/classify")
    AIClassificationResponse classify(@Body AIClassificationRequest request);
}