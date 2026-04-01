from fastapi import FastAPI
from pydantic import BaseModel
from transformers import pipeline

app = FastAPI(title="BETO Classifier API")

NEWS_CATEGORIES = ["Accidente",
                    "Asalto",
                    "Cine",
                    "Cultura",
                    "Deportes",
                    "Emergencia",
                    "Espectáculo",
                    "Política",
                    "Protestas",
                    "Recreación",
                    "Robo",
                    "Salud",
                    "Vandalismo",
                    "Violencia",
                    "Otro"]

classifier = pipeline(
    "zero-shot-classification",
    #model="dccuchile/bert-base-spanish-wwm-cased"      # BETO
    model="Recognai/bert-base-spanish-wwm-cased-xnli"   # RoBERTa
)

class NewsRequest(BaseModel):
    text: str

@app.get("/")
def read_root():
    return {"status": "IA Service Online"}

@app.post("/classify")
async def classify_news(request: NewsRequest):
    result = classifier(
        request.text,
        candidate_labels=NEWS_CATEGORIES,
        hypothesis_template="Esta noticia trata especificamente sobre {}."
    )

    return {
        "top_category": result['labels'][0],
        "confidence": round(result['scores'][0], 4),
        "all_scores": dict(zip(result['labels'], result['scores']))
    }