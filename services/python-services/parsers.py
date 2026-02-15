"""File parsers — PDF, text, code, and image (OCR) extraction."""
import pymupdf
import os
import json
import zipfile
from lxml import etree
from PIL import Image
import pytesseract
from datetime import datetime

LOCAL_DUMP_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "localdump.json")

# In-memory cache buffer — avoids reading/writing JSON on every storeContent call
# Each entry: { "content": str, "metadata": dict }
_cache_buffer: dict[str, dict] = {}
_cache_dirty: bool = False

class File:
    def __init__(self, fileName: str):
        parsed = FileProcessor.parseFile(fileName)
        self.metadata = parsed["metadata"] # Dict
        self.content = parsed["content"] # String

class FileProcessor:
    # Empty constructor since all methods are static, but allows for future state if needed
    def __init__(self):
        pass

    # PDF PARSER
    @staticmethod
    def parsePdf(fileName: str) -> str:
        doc = pymupdf.open(fileName)
        try:
            return "".join(page.get_text() for page in doc)
        finally:
            doc.close()

    # TEXT + CODE PARSER
    @staticmethod
    def parseTxt(fileName: str) -> str:
        with open(fileName, 'r', encoding='utf-8', errors='ignore') as f:
            return f.read()

    # DOCX PARSER — direct XML extraction (faster than python-docx)
    @staticmethod
    def parseDocx(fileName: str) -> str:
        ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
        with zipfile.ZipFile(fileName) as z:
            xml = z.read("word/document.xml")
        tree = etree.fromstring(xml)
        paragraphs = []
        for p in tree.iterfind(".//w:p", ns):
            texts = [t.text for t in p.iterfind(".//w:t", ns) if t.text]
            if texts:
                paragraphs.append("".join(texts))
        return "\n".join(paragraphs)

    # PPTX PARSER — direct XML extraction (faster than python-pptx)
    @staticmethod
    def parsePptx(fileName: str) -> str:
        ns = {"a": "http://schemas.openxmlformats.org/drawingml/2006/main"}
        parts = []
        with zipfile.ZipFile(fileName) as z:
            slide_names = sorted(
                n for n in z.namelist()
                if n.startswith("ppt/slides/slide") and n.endswith(".xml")
            )
            for name in slide_names:
                xml = z.read(name)
                tree = etree.fromstring(xml)
                for p in tree.iterfind(".//a:p", ns):
                    texts = [r.text for r in p.iterfind(".//a:t", ns) if r.text]
                    if texts:
                        parts.append("".join(texts))
        return "\n".join(parts)

    # IMAGE OCR PARSER
    @staticmethod
    def parseImage(fileName: str) -> str:
        img = Image.open(fileName)
        text = pytesseract.image_to_string(img)
        return text.strip()

    # Format bytes to human-readable format
    @staticmethod
    def format_bytes(bytes_size: int) -> str:
        """Convert bytes to human-readable format."""
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if bytes_size < 1024.0:
                return f"{bytes_size:.1f} {unit}"
            bytes_size /= 1024.0
        return f"{bytes_size:.1f} PB"
    

    # Extract metadata such as filename, type, size, and timestamps
    @staticmethod
    def extractMetadata(fileName: str) -> dict:
        """
        Extract file metadata in a format compatible with ranking.py.
        Returns camelCase keys to match ranking service expectations.
        """
        stats = os.stat(fileName)

        return {
            # camelCase for compatibility with ranking.py
            "fileName": os.path.basename(fileName),
            "filePath": os.path.abspath(fileName),
            "fileType": os.path.splitext(fileName)[1].lower(),
            "fileSize": stats.st_size,  # Size in bytes
            "sizeReadable": FileProcessor.format_bytes(stats.st_size), # Human-readable size (2.5 MB)

            # Timestamps as raw values
            "lastModified": stats.st_mtime,
            "lastAccessed": stats.st_atime,

            # Timestamps as readable strings (ISO format for ranking.py)
            "lastModifiedReadable": datetime.fromtimestamp(stats.st_mtime).isoformat(),
            "lastAccessedReadable": datetime.fromtimestamp(stats.st_atime).isoformat(),
        }

    @staticmethod
    def clearCache() -> None:
        """
        Clear the local content cache (both in-memory buffer and localdump.json on disk).
        Call this once at service startup so each session starts fresh.
        """
        global _cache_buffer, _cache_dirty
        _cache_buffer = {}
        _cache_dirty = False

        with open(LOCAL_DUMP_PATH, 'w', encoding='utf-8') as f:
            json.dump({}, f)

        print("Cleared localdump.json cache for new session")

    @staticmethod
    def storeContent(fileName: str, content: str, metadata: dict = None) -> None:
        """
        Cache parsed content and metadata into the in-memory buffer.
        Uses the absolute file path as key to avoid collisions.
        """
        global _cache_buffer, _cache_dirty
        file_path = os.path.abspath(fileName)
        _cache_buffer[file_path] = {
            "content": content,
            "metadata": metadata or {}
        }
        _cache_dirty = True

    @staticmethod
    def flushCache() -> None:
        """
        Write the in-memory cache buffer to localdump.json.
        Called after a batch of files has been parsed.
        """
        global _cache_buffer, _cache_dirty
        if not _cache_dirty:
            return

        # Snapshot the buffer to avoid "dictionary changed size during iteration"
        # when concurrent background tasks call storeContent while we serialize.
        snapshot = dict(_cache_buffer)

        with open(LOCAL_DUMP_PATH, 'w', encoding='utf-8') as f:
            json.dump(snapshot, f, ensure_ascii=False, indent=2)

        _cache_dirty = False
        print(f"Flushed {len(snapshot)} entries to localdump.json")

    @staticmethod
    def loadCachedFile(fileName: str) -> dict | None:
        """
        Load cached content and metadata — checks in-memory buffer first, falls back to disk.
        Returns {"content": str, "metadata": dict} if found, None otherwise.
        """
        global _cache_buffer
        file_path = os.path.abspath(fileName)

        # Check in-memory buffer first (fastest)
        if file_path in _cache_buffer:
            return _cache_buffer[file_path]

        # Fall back to disk
        if not os.path.exists(LOCAL_DUMP_PATH):
            return None

        try:
            with open(LOCAL_DUMP_PATH, 'r', encoding='utf-8') as f:
                text = f.read().strip()
                if not text:
                    return None
                dump = json.loads(text)
                # Populate buffer from disk for future lookups
                _cache_buffer.update(dump)
                return dump.get(file_path)
        except (json.JSONDecodeError, IOError):
            return None

    @staticmethod
    def loadContent(fileName: str) -> str | None:
        """
        Load cached content only. Convenience wrapper around loadCachedFile.
        Returns the content string if found, None otherwise.
        """
        cached = FileProcessor.loadCachedFile(fileName)
        if cached is not None:
            return cached.get("content")
        return None

    @staticmethod
    def parseFile(fileName: str) -> dict:
        """
        Parse a file and extract both metadata and content.

        Handles case-insensitive file extensions and files without extensions.
        """
        # Extracts metadata
        metadata = FileProcessor.extractMetadata(fileName)

        # Parses the file content - normalize to lowercase for case-insensitive matching
        file_type = metadata["fileType"].lower()
        content = ""

        if file_type == ".pdf":
            content = FileProcessor.parsePdf(fileName)
        elif file_type in (".txt", ".md", ".py", ".js", ".ts", ".json", ".csv", ".html", ".css", ""):
            # Handle plain-text files: text, markdown, code, data, and extensionless (README, Makefile, etc.)
            content = FileProcessor.parseTxt(fileName)
        elif file_type == ".docx":
            content = FileProcessor.parseDocx(fileName)
        elif file_type == ".pptx":
            content = FileProcessor.parsePptx(fileName)
        elif file_type in (".png", ".jpg", ".jpeg"):
            content = FileProcessor.parseImage(fileName)
        else:
            raise ValueError(f"Unsupported file type: {file_type}")

        # Cache the parsed content and metadata for later quick reference
        FileProcessor.storeContent(fileName, content, metadata)
        # Flush to disk after each parse so content is persisted
        FileProcessor.flushCache()

        return {
            "metadata": metadata,
            "content": content
        }


    # Takes in list of filenames from pinecone service
    @staticmethod
    def sendToRankingService(fileNames: list[str]) -> list[File]:
        """
        Send files to ranking service for processing and return ranked list of File objects.
        Uses cached content from localdump.json when available to avoid re-parsing.
        """
        files = []
        for fileName in fileNames:
            print(f"Processing file for ranking: {fileName}")
            cached = FileProcessor.loadCachedFile(fileName)
            if cached is not None:
                # Build File from cache — skip expensive re-parse and os.stat
                f = object.__new__(File)
                f.metadata = cached["metadata"]
                f.content = cached["content"]
                files.append(f)
            else:
                # Cache miss — full parse (which also populates the cache)
                files.append(File(fileName))

        return files


    @staticmethod
    def chunkContent(content: str, chunk_size: int = 500, overlap: int = 100) -> list[str]:
        """
        Chunk content into pieces with optional overlap for better context in vectorization.
        """
        if not content or len(content) <= chunk_size:
            return [content] if content else []

        chunks = []
        start = 0

        while start < len(content):
            # Get chunk from start to start + chunk_size
            end = start + chunk_size
            chunk = content[start:end]

            # If not the last chunk and we're not at a natural break, try to break at sentence/word
            if end < len(content):
                # Try to break at sentence (period, question mark, exclamation)
                last_sentence = max(chunk.rfind('. '), chunk.rfind('? '), chunk.rfind('! '))
                if last_sentence > chunk_size * 0.5:  # Only break at sentence if it's past halfway
                    chunk = chunk[:last_sentence + 1]
                    end = start + last_sentence + 1
                else:
                    # Otherwise try to break at word boundary
                    last_space = chunk.rfind(' ')
                    if last_space > 0:
                        chunk = chunk[:last_space]
                        end = start + last_space

            chunks.append(chunk.strip())

            # Move start forward, accounting for overlap
            start = end - overlap if end < len(content) else end

        return chunks


    @staticmethod
    def prepareForPinecone(fileName: str, chunk_size: int = 500, overlap: int = 100) -> dict:
        """
        Parse a file and prepare it for Pinecone ingestion.
        """
        # Parse file to get content and metadata
        parsed = FileProcessor.parseFile(fileName)

        # Chunk the content
        chunks = FileProcessor.chunkContent(parsed["content"], chunk_size, overlap)

        return {
            "chunks": chunks,
            "metadata": parsed["metadata"],
        }
