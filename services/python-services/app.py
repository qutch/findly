"""Document processing service — extracts text from files."""

from fastapi import FastAPI

app = FastAPI()


@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/process-file")
async def process_file(file: dict):
    return {"status": "processed", "file": file}

@app.get("/search")
async def search(query: str):
    return {"status": "searching", "query": query}