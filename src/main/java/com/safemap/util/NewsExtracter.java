package com.safemap.util;

import com.safemap.pojo.*;

import java.util.ArrayList;
import java.util.List;

public class NewsExtracter {

    public static List<NewsResult> extractNewsFromApiResults(ApiResults apiResults){
        List<NewsResult> resultingList = new ArrayList<>(apiResults.getNews_results());
        apiResults.getSub_articles().forEach(subarticle -> {
            if (!subarticle.getNews_results().isEmpty()){
                resultingList.addAll(subarticle.getNews_results());
            }
        });
        return resultingList;
    }
}
