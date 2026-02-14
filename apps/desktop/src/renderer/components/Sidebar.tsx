import type { Folder } from "../types";
import { FolderIcon, PlusIcon, XIcon, FolderPlusIcon } from "./Icons";

interface SidebarProps {
  folders: Folder[];
  onAddFolder: () => void;
  onRemoveFolder: (path: string) => void;
}

export function Sidebar({ folders, onAddFolder, onRemoveFolder }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">Folders</span>
        <div className="sidebar-actions">
          <button className="btn-icon" onClick={onAddFolder} title="Add folder">
            <PlusIcon />
          </button>
        </div>
      </div>

      {folders.length === 0 ? (
        <div className="empty-state">
          <FolderPlusIcon className="empty-state-icon" />
          <span className="empty-state-text">
            Add folders to index
            <br />
            and search their contents
          </span>
          <button className="btn-add-folder" onClick={onAddFolder}>
            <PlusIcon size={14} />
            Add Folder
          </button>
        </div>
      ) : (
        <div className="folder-list">
          {folders.map((folder) => (
            <div key={folder.path} className="folder-item">
              <FolderIcon className="folder-icon" />
              <div className="folder-info">
                <div className="folder-name">{folder.name}</div>
                <div className="folder-path">{folder.path}</div>
              </div>
              <button
                className="folder-remove"
                onClick={() => onRemoveFolder(folder.path)}
                title="Remove folder"
              >
                <XIcon size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
