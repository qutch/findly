"""Document processing service — extracts text from files."""

from fastapi import FastAPI

app = FastAPI()


@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/process-file")
async def process_file(file: dict):
    return {"status": "processed", "file": file}

@app.post("/extract-metadata")
async def extract_metadata(file: dict):
    return {"status": "metadata extracted", "file": file}