import unittest
from unittest.mock import patch

from parsers import FileProcessor
from pineconeService import PinconeService


class _FakeEmbeddingItem:
    def __init__(self, embedding):
        self.embedding = embedding


class _FakeEmbeddingResponse:
    def __init__(self, embeddings):
        self.data = [_FakeEmbeddingItem(e) for e in embeddings]


class _FakeOpenAIEmbeddings:
    def create(self, model, input):
        if isinstance(input, list):
            embeddings = [[float(i), float(i) + 0.5] for i, _ in enumerate(input)]
            return _FakeEmbeddingResponse(embeddings)
        return _FakeEmbeddingResponse([[1.0, 2.0]])


class _FakeOpenAIClient:
    def __init__(self):
        self.embeddings = _FakeOpenAIEmbeddings()


class _FakeIndex:
    def __init__(self):
        self.upserts = []

    def upsert(self, vectors):
        self.upserts.extend(vectors)

    def query(self, vector, top_k, include_metadata, filter):
        class Match:
            def __init__(self, score, metadata):
                self.score = score
                self.metadata = metadata

        class Results:
            def __init__(self):
                self.matches = [
                    Match(0.9, {"filePath": "/tmp/a.txt", "chunk_index": 0, "text": "a"}),
                    Match(0.8, {"filepath": "/tmp/a.txt", "chunk_index": 1, "text": "b"}),
                    Match(0.7, {"filePath": "/tmp/b.txt", "chunk_index": 2, "text": "c"}),
                ]

        return Results()


class VectorSmokeTest(unittest.TestCase):
    def setUp(self):
        PinconeService._instance = None
        PinconeService._initialized = False
        self.service = PinconeService()
        self.service.openai_client = _FakeOpenAIClient()
        self.service.index = _FakeIndex()
        self.service._initialized = True

    def test_index_file_upserts_one_vector_per_chunk(self):
        chunks = ["alpha", "beta", "gamma"]
        metadata = {"filePath": "/tmp/file.txt"}
        self.service.indexFile(chunks=chunks, metadata=metadata, file_id="tmp_file_txt")

        self.assertEqual(len(self.service.index.upserts), len(chunks))
        self.assertEqual(self.service.index.upserts[0]["id"], "tmp_file_txt_0")
        self.assertEqual(self.service.index.upserts[1]["metadata"]["chunk_index"], 1)
        self.assertEqual(self.service.index.upserts[0]["metadata"]["filepath"], "/tmp/file.txt")

    def test_query_dedupes_by_file_path_key_variants(self):
        results = self.service.query("hello world")
        self.assertEqual(len(results), 2)
        self.assertEqual(results[0]["filePath"], "/tmp/a.txt")
        self.assertEqual(results[1]["filePath"], "/tmp/b.txt")

    def test_send_to_pinecone_wires_index_file_call(self):
        prepared = {
            "chunks": ["chunk-a", "chunk-b"],
            "metadata": {"filePath": "/tmp/demo.txt", "fileName": "demo.txt"},
        }
        with patch.object(FileProcessor, "prepareForPinecone", return_value=prepared):
            with patch("pineconeService.PinconeService.indexFile") as index_mock:
                FileProcessor.sendToPinecone("/tmp/demo.txt")
                index_mock.assert_called_once()
                kwargs = index_mock.call_args.kwargs
                self.assertEqual(kwargs["chunks"], prepared["chunks"])
                self.assertEqual(kwargs["metadata"]["filePath"], "/tmp/demo.txt")
                self.assertEqual(kwargs["file_id"], "_tmp_demo.txt")


if __name__ == "__main__":
    unittest.main()
