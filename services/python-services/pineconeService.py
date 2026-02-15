import os
from pinecone import Pinecone, ServerlessSpec
from openai import OpenAI

class PineconeService:

    _instance = None
    _initialized = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            print("Creating new PineconeService instance")
        else:
            print("Returning existing PineconeService instance")

        return cls._instance

    def ensure_initialize(self):
        if self._initialized:
            print("Already initialized, skipping...")
            return

        print("Initializing Pinecone connection...")

        self.client = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
        self.openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

        index_name = os.getenv("PINECONE_INDEX")

        if index_name not in self.client.list_indexes().names():
            print(f"Creating index {index_name}...")
            self.client.create_index(
                name=index_name,
                dimension=1536,  # text-embedding-3-small dimension
                metric="cosine",
                spec=ServerlessSpec(
                    cloud="aws",
                    region="us-east-1"
                )
            )

        self.index = self.client.Index(index_name)

        self._initialized = True

    def _embed_text(self, text: str) -> list[float]:
        """Create embedding for text using OpenAI."""
        response = self.openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=text
        )
        return response.data[0].embedding

    def indexFile(self, chunks: list[str], metadata: dict, file_id: str):
        self.ensure_initialize()

        # Step 1: Collect all embeddings (batch OpenAI calls in groups of 100)
        embeddings = []
        embed_batch_size = 100

        for i in range(0, len(chunks), embed_batch_size):
            batch = chunks[i:i + embed_batch_size]
            response = self.openai_client.embeddings.create(
                model="text-embedding-3-small",
                input=batch
            )
            embeddings.extend([item.embedding for item in response.data])

        # Step 2: Build vectors with unique IDs
        vectors = [
            {
                "id": f"{file_id}_{idx}",
                "values": embedding,
                "metadata": {
                    "text": chunk,
                    "chunk_index": idx,
                    **metadata
                }
            }
            for idx, (chunk, embedding) in enumerate(zip(chunks, embeddings))
        ]

        # Step 3: Upsert to Pinecone in batches
        upsert_batch_size = 100
        total_batches = (len(vectors) - 1) // upsert_batch_size + 1

        for i in range(0, len(vectors), upsert_batch_size):
            batch = vectors[i:i + upsert_batch_size]
            self.index.upsert(vectors=batch)
            print(f"Uploaded batch {i // upsert_batch_size + 1}/{total_batches}")

    def query(self, query_text: str, filter: dict = None) -> list[dict]:
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
            filepath = match.metadata.get("filePath")
            if filepath and filepath not in seen_files:
                seen_files.add(filepath)
                unique_matches.append({
                    "score": match.score,
                    **{k: v for k, v in match.metadata.items() if k != "text"}
                })

                if len(unique_matches) >= 20:
                    break

        return unique_matches


