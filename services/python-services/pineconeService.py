import os
from dotenv import load_dotenv

# Load environment variables from root .env file
dotenv_path = os.path.join(os.path.dirname(__file__), "../../.env")
load_dotenv(dotenv_path)

try:
    from pinecone import Pinecone, ServerlessSpec
except Exception as e:
    Pinecone = None
    ServerlessSpec = None
    _pinecone_import_error = e
else:
    _pinecone_import_error = None

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

class PinconeService:

    _instance = None
    _initialized = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            print("[pinecone] creating PinconeService singleton")
        else:
            print("[pinecone] reusing PinconeService singleton")

        return cls._instance

    def ensure_initialize(self):
        if self._initialized:
            print("[pinecone] already initialized, skipping")
            return

        print("[pinecone] initializing connection...")

        if Pinecone is None:
            raise ImportError(
                "pinecone SDK import failed. Ensure deprecated `pinecone-client` is removed and "
                "the `pinecone` package is installed. "
                f"Original error: {_pinecone_import_error}"
            )
        if OpenAI is None:
            raise ImportError("openai package is not installed. Install dependencies from requirements.txt")

        pinecone_api_key = os.getenv("PINECONE_API_KEY")
        openai_api_key = os.getenv("OPENAI_API_KEY")
        index_name = os.getenv("PINECONE_INDEX_NAME") or os.getenv("PINECONE_INDEX")
        index_host = os.getenv("PINECONE_INDEX_HOST")
        pinecone_cloud = os.getenv("PINECONE_CLOUD", "aws")
        pinecone_region = os.getenv("PINECONE_REGION", "us-east-1")
        print(
            "[pinecone] config:",
            f"index_name={'set' if index_name else 'unset'}",
            f"index_host={'set' if index_host else 'unset'}",
            f"cloud={pinecone_cloud}",
            f"region={pinecone_region}",
        )

        if not pinecone_api_key:
            raise ValueError("Missing PINECONE_API_KEY in environment")
        if not openai_api_key:
            raise ValueError("Missing OPENAI_API_KEY in environment")
        if not index_name and not index_host:
            raise ValueError(
                "Missing Pinecone index target. Set PINECONE_INDEX_NAME/PINECONE_INDEX "
                "or set PINECONE_INDEX_HOST for direct index access."
            )

        self.client = Pinecone(api_key=pinecone_api_key)
        self.openai_client = OpenAI(api_key=openai_api_key)

        # If host is provided, skip control-plane calls (list/create indexes) and connect directly.
        if index_host:
            print("[pinecone] connecting via index host")
            self.index = self.client.Index(host=index_host)
        else:
            print(f"[pinecone] connecting via control plane for index '{index_name}'")
            if index_name not in self.client.list_indexes().names():
                print(f"[pinecone] creating index '{index_name}'")
                self.client.create_index(
                    name=index_name,
                    dimension=1536,  # text-embedding-3-small dimension
                    metric="cosine",
                    spec=ServerlessSpec(
                        cloud=pinecone_cloud,
                        region=pinecone_region
                    )
                )
            self.index = self.client.Index(index_name)

        self._initialized = True
        print("[pinecone] initialization complete")

    def _embed_text(self, text: str) -> list[float]:
        """Create embedding for text using OpenAI."""
        response = self.openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=text
        )
        return response.data[0].embedding

    def indexFile(self, chunks: list[str], metadata: dict, file_id: str):
        print(f"[pinecone] indexFile start file_id={file_id} chunks={len(chunks)}")
        self.ensure_initialize()

        if not chunks:
            print("[pinecone] indexFile skip: no chunks")
            return

        batch_size = 100
        metadata = dict(metadata or {})
        metadata["filepath"] = metadata.get("filePath") or metadata.get("filepath")
        upsert_batch_size = 100

        for batch_start in range(0, len(chunks), batch_size):
            batch_chunks = chunks[batch_start:batch_start + batch_size]
            print(
                "[pinecone] embedding batch",
                f"start={batch_start}",
                f"count={len(batch_chunks)}",
            )
            response = self.openai_client.embeddings.create(
                model="text-embedding-3-small",
                input=batch_chunks
            )
            batch_embeddings = [item.embedding for item in response.data]

            vectors = [
                {
                    "id": f"{file_id}_{batch_start + offset}",
                    "values": embedding,
                    "metadata": {
                        "text": chunk,
                        "chunk_index": batch_start + offset,
                        **metadata
                    }
                }
                for offset, (chunk, embedding) in enumerate(zip(batch_chunks, batch_embeddings))
            ]

            for upsert_start in range(0, len(vectors), upsert_batch_size):
                upsert_batch = vectors[upsert_start:upsert_start + upsert_batch_size]
                self.index.upsert(vectors=upsert_batch)
                total_batches = (len(vectors) - 1) // upsert_batch_size + 1
                print(f"[pinecone] upserted batch {upsert_start // upsert_batch_size + 1}/{total_batches}")

        print(f"[pinecone] indexFile complete file_id={file_id}")

    def query(self, query_text: str, filter: dict = None) -> list[dict]:
        print(f"[pinecone] query start text='{query_text}'")
        self.ensure_initialize()

        query_embedding = self._embed_text(query_text)

        results = self.index.query(
            vector=query_embedding,
            top_k=100,
            include_metadata=True,
            filter=filter
        )

        seen_files = set()
        unique_matches = []

        for match in results.matches:
            filepath = match.metadata.get("filePath") or match.metadata.get("filepath")
            if filepath and filepath not in seen_files:
                seen_files.add(filepath)
                unique_matches.append({
                    "score": match.score,
                    **{k: v for k, v in match.metadata.items() if k != "text"}
                })

                if len(unique_matches) >= 20:
                    break

        print(f"[pinecone] query complete unique_matches={len(unique_matches)}")
        return unique_matches
