import { useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { SearchBar } from "./components/SearchBar";
import type { Folder, SearchResult, File } from "./types";

export default function App() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);

  // Handles adding a new folder
  const handleAddFolder = async () => {
    const folder = await window.api.selectFolder();
    if (!folder) return;

    // Don't add duplicates
    if (folders.some((f) => f.path === folder.path)) return;
    setFolders((prev) => [...prev, folder]);
  };

  // Handles searches
  const handleSearch = async () => {
    if (!query.trim()) return [];
    const results = await window.api.search(query);
    setResults(results);
    return results;
  };

  const handleRemoveFolder = (path: string) => {
    setFolders((prev) => prev.filter((f) => f.path !== path));
  };

  return (
    <div className="app">
      <Sidebar
        folders={folders}
        onAddFolder={handleAddFolder}
        onRemoveFolder={handleRemoveFolder}
      />
      <main className="main-content">
        <div className="main-placeholder">
          <div className="main-placeholder-title">Findly</div>
          <div className="main-placeholder-subtitle">
            {folders.length === 0
              ? "Add a folder to get started"
              : "Search your files"}
          </div>
          {folders.length === 0
          ? <></>
          :<SearchBar query={query} onQueryChange={setQuery} onSearch={handleSearch} />}
        </div>
      </main>
    </div>
  );
}
