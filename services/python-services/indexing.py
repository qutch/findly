import hashlib
from pineconeService import PineconeService
from parsers import FileProcessor


def _file_id(file_path: str) -> str:
    """Derive a stable, unique file ID from the absolute path."""
    return "file_" + hashlib.md5(file_path.encode()).hexdigest()[:12]


def uploadFileToPinecone(filePath: str):
    # Step 1 — Parse, chunk, and prepare metadata
    toUpload = FileProcessor.prepareForPinecone(filePath)

    # Step 2 — Upload to Pinecone (singleton handles lazy init)
    pc = PineconeService()
    file_id = _file_id(filePath)
    pc.indexFile(toUpload["chunks"], toUpload["metadata"], file_id)
