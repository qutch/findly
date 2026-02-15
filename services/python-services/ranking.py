import os
import json
import sys
from typing import List, Dict, Any, Optional, Union
from datetime import datetime
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Load environment variables from root .env file
dotenv_path = os.path.join(os.path.dirname(__file__), '../../.env')
load_dotenv(dotenv_path)


class FileRankingService:
    """
    Service to rank files using Gemini API based on relevance to user queries.
    """
    
    def __init__(self, gemini_api_key: str):
        """
        Initialize the service with Gemini API credentials.
        
        Args:
            gemini_api_key: The Google Gemini API key
        """
        self.client = genai.Client(api_key=gemini_api_key)
        self.model_name = 'gemini-3-flash-preview'
    
    def _normalize_files(self, files: List[Any]) -> List[Dict[str, Any]]:
        """
        Normalize input files to flat dicts.
        Accepts File objects from sendToRankingService (parsers.py).
        Each File object has .metadata (dict) and .content (string).
        Uses only readable timestamp fields: lastModifiedReadable and lastAccessedReadable.
        """
        normalized = []
        for f in files:
            if not (hasattr(f, 'metadata') and hasattr(f, 'content')):
                raise ValueError(
                    f"Invalid input: expected File objects from sendToRankingService. "
                    f"Got {type(f).__name__} instead."
                )
            
            # File object from parsers.py — flatten metadata + content
            file_data = {**f.metadata, 'content': f.content}
            
            normalized.append(file_data)
        return normalized

    def _format_file_data_for_ranking(self, files: List[Dict[str, Any]]) -> str:
        """
        Format file metadata into a structured string for Gemini API.
        
        Args:
            files: List of file metadata dictionaries
            
        Returns:
            Formatted string representation of files
        """
        formatted_data = []
        
        for idx, file in enumerate(files, 1):
            file_info = f"""
File {idx}:
- File Name: {file.get('fileName', 'Unknown')}
- File Path: {file.get('filePath', 'Unknown')}
- File Type: {file.get('fileType', 'Unknown')}
- File Size: {file.get('fileSize', 'Unknown')} bytes
- Last Accessed: {file.get('lastAccessedReadable', 'Unknown')}
- Last Edited: {file.get('lastModifiedReadable', 'Unknown')}
- Content Preview: {self._truncate_content(file.get('content', ''))}
"""
            formatted_data.append(file_info)
        
        return '\n'.join(formatted_data)
    
    def _truncate_content(self, content: str, max_length: int = 500) -> str:
        """
        Truncate file content to avoid token limits.
        
        Args:
            content: The file content to truncate
            max_length: Maximum length of content
            
        Returns:
            Truncated content string
        """
        if not content:
            return 'No content available'
        
        if len(content) <= max_length:
            return content
        
        return content[:max_length] + '... [truncated]'
    
    async def rank_files(
        self,
        user_query: str,
        files: List[Any]
    ) -> Dict[str, Any]:
        """
        Rank files using Gemini API and generate summaries.
        
        Args:
            user_query: The user's search query
            files: List of File objects from parsers.sendToRankingService()
            
        Returns:
            Dictionary containing success status, message, and ranked files
        """
        if not files:
            return {
                'success': False,
                'message': 'No files provided',
                'rankedFiles': []
            }
        
        # Normalize input: accept File objects or flat dicts
        files = self._normalize_files(files)
        
        # Format file data for Gemini
        formatted_files = self._format_file_data_for_ranking(files)
        
        # Create the ranking prompt
        prompt = f"""
You are a file ranking assistant. Given a user's query and a list of files with their metadata, 
rank the files based on their relevance to the query and provide a brief 2-line summary for each file.

Consider:
- File name and type relevance
- Content relevance (if available)
- Recency of access/editing (more recent = potentially more relevant)
- File location/path relevance

User Query: "{user_query}"

Files to Rank:
{formatted_files}

Instructions:
1. Analyze each file's relevance to the query
2. Rank them from most relevant to least relevant
3. For each file, provide a 2-line summary explaining what the file is about and why it's relevant
4. Return ONLY a JSON array of objects with this exact structure:
[
  {{
    "filePath": "path/to/file",
    "summary": "Two line summary of the content of the file (descriptive). Maximum two sentences.",
    "rank": 1
  }},
  {{
    "filePath": "path/to/another/file",
    "summary": "Two line summary of the content of the file (descriptive). Maximum two sentences.",
    "rank": 2
  }}
]
5. Do not include any explanation or markdown, just the JSON array
6. Ensure each summary is exactly 2 lines or 2 sentences maximum
7. Order by rank (most relevant = rank 1)

Your Response:
"""
        
        try:
            print('Ranking files with Gemini API...')
            
            # Call Gemini API
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    thinking_config=types.ThinkingConfig(thinking_level="minimal")
                ),
            )
            text = response.text
            
            # Parse the response
            ranked_files = self._parse_gemini_response(text, files)
            
            return {
                'success': True,
                'message': f'Successfully ranked {len(ranked_files)} files',
                'rankedFiles': ranked_files
            }
        except Exception as error:
            print(f'Error ranking files with Gemini: {error}')
            
            # Fallback: return files in original order with generic summaries
            fallback_files = [
                {
                    'filePath': file.get('filePath'),
                    'summary': f"{file.get('fileName')} - {file.get('fileType')} file. Last edited: {file.get('lastModifiedReadable', 'Unknown')}",
                    'rank': idx + 1
                }
                for idx, file in enumerate(files)
            ]
            
            return {
                'success': False,
                'message': 'Error ranking files, returning default order',
                'rankedFiles': fallback_files
            }
    
    def rank_files_sync(
        self,
        user_query: str,
        files: List[Any]
    ) -> Dict[str, Any]:
        """
        Synchronous version of rank_files.
        
        Args:
            user_query: The user's search query
            files: List of File objects from parsers.sendToRankingService()
            
        Returns:
            Dictionary containing success status, message, and ranked files
        """
        if not files:
            return {
                'success': False,
                'message': 'No files provided',
                'rankedFiles': []
            }
        
        # Normalize input: accept File objects or flat dicts
        files = self._normalize_files(files)
        
        # Format file data for Gemini
        formatted_files = self._format_file_data_for_ranking(files)
        
        # Create the ranking prompt
        prompt = f"""
You are a file ranking assistant. Given a user's query and a list of files with their metadata, 
rank the files based on their relevance to the query and provide a brief 2-line summary for each file.

Consider:
- File name and type relevance
- Content relevance (if available)
- Recency of access/editing (more recent = potentially more relevant)
- File location/path relevance

User Query: "{user_query}"

Files to Rank:
{formatted_files}

Instructions:
1. Analyze each file's relevance to the query
2. Rank them from most relevant to least relevant
3. For each file, provide a 2-line summary explaining what the file is about and why it's relevant
4. Return ONLY a JSON array of objects with this exact structure:
[
  {{
    "filePath": "path/to/file",
    "summary": "Two line summary of the content of the file (descriptive). Maximum two sentences.",
    "rank": 1
  }},
  {{
    "filePath": "path/to/another/file",
    "summary": "Two line summary of the content of this file (descriptive). Maximum two sentences.",
    "rank": 2
  }}
]
5. Do not include any explanation or markdown, just the JSON array
6. Ensure each summary is exactly 2 lines or 2 sentences maximum
7. Order by rank (most relevant = rank 1)

Your Response:
"""
        
        try:
            print('Ranking files with Gemini API...')
            
            # Call Gemini API
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    thinking_config=types.ThinkingConfig(thinking_level="minimal")
                ),
            )
            text = response.text
            
            # Parse the response
            ranked_files = self._parse_gemini_response(text, files)
            
            return {
                'success': True,
                'message': f'Successfully ranked {len(ranked_files)} files',
                'rankedFiles': ranked_files
            }
        except Exception as error:
            print(f'Error ranking files with Gemini: {error}')
            
            # Fallback: return files in original order with generic summaries
            fallback_files = [
                {
                    'filePath': file.get('filePath'),
                    'summary': f"{file.get('fileName')} - {file.get('fileType')} file. Last edited: {file.get('lastModifiedReadable', 'Unknown')}",
                    'rank': idx + 1
                }
                for idx, file in enumerate(files)
            ]
            
            return {
                'success': False,
                'message': 'Error ranking files, returning default order',
                'rankedFiles': fallback_files
            }
    
    def _parse_gemini_response(
        self,
        response_text: str,
        original_files: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Parse Gemini's response to extract ranked files with summaries.
        
        Args:
            response_text: The raw response text from Gemini
            original_files: The original list of files
            
        Returns:
            List of ranked files with summaries
        """
        try:
            # Clean up response text (remove markdown code blocks if present)
            cleaned_text = response_text.strip()
            
            if cleaned_text.startswith('```json'):
                cleaned_text = cleaned_text[7:]
            if cleaned_text.startswith('```'):
                cleaned_text = cleaned_text[3:]
            if cleaned_text.endswith('```'):
                cleaned_text = cleaned_text[:-3]
            
            cleaned_text = cleaned_text.strip()
            
            # Parse JSON
            ranked_files = json.loads(cleaned_text)
            
            # Validate that it's an array with correct structure
            if isinstance(ranked_files, list) and len(ranked_files) > 0:
                # Ensure all objects have required fields
                valid_files = [
                    file for file in ranked_files
                    if file.get('filePath') and file.get('summary') and file.get('rank')
                ]
                
                if len(valid_files) > 0:
                    return valid_files
            
            raise ValueError('Invalid response structure')
        except Exception as error:
            print(f'Error parsing Gemini response: {error}')
            print(f'Raw response: {response_text}')
            
            # Fallback: return original files with generic summaries
            return [
                {
                    'filePath': file.get('filePath'),
                    'summary': f"{file.get('fileName')} - {file.get('fileType')} file. Last edited: {file.get('lastModifiedReadable', 'Unknown')}",
                    'rank': idx + 1
                }
                for idx, file in enumerate(original_files)
            ]

# Example usage
def main():
    """
    Example usage with parsers.py:
    
        from parsers import sendToRankingService
        files = sendToRankingService(["/path/to/file1.pdf", "/path/to/file2.docx"])
        result = service.rank_files_sync(user_query, files)
    
    Note: This service ONLY accepts File objects from sendToRankingService.
    """
    # Debug: Check if API key is loaded
    api_key = os.getenv('GEMINI_API_KEY')
    print(f"API Key loaded: {'Yes ✓' if api_key else 'No ✗'}")
    print(f"API Key length: {len(api_key) if api_key else 0}")
    
    # Initialize the service
    service = FileRankingService(api_key or '')
    
    # --- Option 1: Use real files via parsers.py ---
    # from parsers import sendToRankingService
    # files = sendToRankingService(["/path/to/file1.pdf", "/path/to/file2.docx"])
    
    # --- Option 2: Create test File objects ---
    from parsers import File
    
    # Create mock File objects for testing
    class MockFile:
        def __init__(self, metadata, content):
            self.metadata = metadata
            self.content = content
    
    files = [
        MockFile(
            metadata={
                'fileName': 'math_homework-1.pdf',
                'filePath': '/documents/school/math_homework-1.pdf',
                'fileType': 'docx',
                'fileSize': 245672,
                'lastAccessedReadable': '2024-02-13T15:30:00Z',
                'lastModifiedReadable': '2024-02-13T14:20:00Z'
            },
            content='Algebra problems from chapter 5. Includes quadratic equations, polynomials, and word problems. Due date: Tomorrow.'
        ),
        MockFile(
            metadata={
                'fileName': 'math_homework-2.docx',
                'filePath': '/documents/school/math_homework-2.docx',
                'fileType': 'docx',
                'fileSize': 123456,
                'lastAccessedReadable': '2024-02-12T10:15:00Z',
                'lastModifiedReadable': '2024-02-10T09:30:00Z'
            },
            content='Notes from algebra class covering linear equations and graphing. Includes examples and practice problems.'
        ),
        MockFile(
            metadata={
                'fileName': 'project_plan.txt',
                'filePath': '/documents/work/project_plan.txt',
                'fileType': 'txt',
                'fileSize': 98765,
                'lastAccessedReadable': '2024-02-11T09:00:00Z',
                'lastModifiedReadable': '2024-02-11T08:45:00Z'
            },
            content='Project planning document for Q1 objectives and milestones.'
        )
    ]
    
    user_query = 'bring up the math hw I was working on the latest'
    
    result = service.rank_files_sync(user_query, files)
    
    if result['success']:
        print('\n✅ Ranked Files (Most relevant first):\n')
        for file in result['rankedFiles']:
            print(f"{file['rank']}. {file['filePath']}")
            print(f"   Summary: {file['summary']}")
            print('')
    else:
        print(f"❌ Error: {result['message']}")


if __name__ == '__main__':
    main()
