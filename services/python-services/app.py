"""Document processing service — extracts text from files."""

from fastapi import FastAPI

app = FastAPI()


@app.get("/health")
async def health():
    return {"status": "ok"}

# Called from watcher when a new file is added or modified
@app.post("/process-file")
async def process_file(file: dict):
    return {"status": "processed", "file": file}

# Called from electron app when user clicks "Search" button, with the search query as a parameter
@app.get("/search")
async def search(query: str):
    return {"status": "searching", "query": query}