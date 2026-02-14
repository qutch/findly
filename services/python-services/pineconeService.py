import os
from typing import Any, Dict, List

from openai import OpenAI
from pinecone import Pinecone, ServerlessSpec


class PineconeService:
    def __init__(self) -> None:
        self._initialized = False
        self.client: Pinecone | None = None
        self.index = None
        self.openai_client: OpenAI | None = None

    def _require_env(self, key: str) -> str:
        value = os.getenv(key)
        if not value:
            raise ValueError(f"Missing required environment variable: {key}")
        return value

    def ensure_initialized(self) -> None:
        if self._initialized:
            return

        pinecone_api_key = self._require_env("PINECONE_API_KEY")
        openai_api_key = self._require_env("OPENAI_API_KEY")
        index_name = self._require_env("PINECONE_INDEX_NAME")

        self.client = Pinecone(api_key=pinecone_api_key)
        self.openai_client = OpenAI(api_key=openai_api_key)

        existing_indexes = self.client.list_indexes().names()
        if index_name not in existing_indexes:
            self.client.create_index(
                name=index_name,
                dimension=1536,  # text-embedding-3-small
                metric="cosine",
                spec=ServerlessSpec(cloud="aws", region="us-east-1"),
            )

        self.index = self.client.Index(index_name)
        self._initialized = True

    def _embed_texts(self, texts: List[str]) -> List[List[float]]:
        self.ensure_initialized()
        if not texts:
            return []

        assert self.openai_client is not None
        response = self.openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=texts,
        )
        return [item.embedding for item in response.data]

    def index_file(self, chunks: List[str], metadata: Dict[str, Any], file_id: str) -> None:
        self.ensure_initialized()
        if not chunks:
            return

        assert self.index is not None

        embeddings = self._embed_texts(chunks)
        vectors = []
        for idx, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            vectors.append(
                {
                    "id": f"{file_id}:{idx}",
                    "values": embedding,
                    "metadata": {
                        **metadata,
                        "text": chunk,
                        "chunkIndex": idx,
                        "fileId": file_id,
                    },
                }
            )

        batch_size = 100
        for start in range(0, len(vectors), batch_size):
            self.index.upsert(vectors=vectors[start : start + batch_size])

    def query_file_paths(self, query_text: str, top_k: int = 20) -> List[str]:
        self.ensure_initialized()
        if not query_text.strip():
            return []

        assert self.index is not None
        query_embedding = self._embed_texts([query_text])[0]
        results = self.index.query(
            vector=query_embedding,
            top_k=top_k,
            include_metadata=True,
        )

        seen = set()
        ordered_paths: List[str] = []
        for match in results.matches:
            metadata = match.metadata or {}
            file_path = metadata.get("filePath")
            if not file_path or file_path in seen:
                continue
            seen.add(file_path)
            ordered_paths.append(str(file_path))

        return ordered_paths


_service: PineconeService | None = None


def get_pinecone_service() -> PineconeService:
    global _service
    if _service is None:
        _service = PineconeService()
    return _service


def queryPinecone(query_text: str, top_k: int = 20) -> List[str]:
    return get_pinecone_service().query_file_paths(query_text, top_k=top_k)
