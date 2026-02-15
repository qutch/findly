interface IconProps {
  size?: number;
  className?: string;
}

type FileCategory =
  | "document"
  | "spreadsheet"
  | "presentation"
  | "pdf"
  | "image"
  | "video"
  | "audio"
  | "code"
  | "archive"
  | "font"
  | "executable"
  | "generic";

const EXTENSION_MAP: Record<string, FileCategory> = {
  // Documents
  doc: "document", docx: "document", txt: "document", rtf: "document",
  odt: "document", pages: "document",
  // Spreadsheets
  xls: "spreadsheet", xlsx: "spreadsheet", csv: "spreadsheet", numbers: "spreadsheet",
  // Presentations
  ppt: "presentation", pptx: "presentation", key: "presentation",
  // PDF
  pdf: "pdf",
  // Images
  png: "image", jpg: "image", jpeg: "image", gif: "image", svg: "image",
  webp: "image", bmp: "image", ico: "image", tiff: "image",
  // Video
  mp4: "video", mov: "video", avi: "video", mkv: "video", webm: "video", flv: "video",
  // Audio
  mp3: "audio", wav: "audio", flac: "audio", aac: "audio", ogg: "audio",
  m4a: "audio", wma: "audio",
  // Code
  ts: "code", tsx: "code", js: "code", jsx: "code", py: "code", rb: "code",
  go: "code", rs: "code", java: "code", c: "code", cpp: "code", h: "code",
  cs: "code", swift: "code", kt: "code", html: "code", css: "code",
  scss: "code", json: "code", xml: "code", yaml: "code", yml: "code",
  toml: "code", sh: "code", bash: "code", zsh: "code", sql: "code",
  graphql: "code", md: "code", mdx: "code",
  // Archives
  zip: "archive", tar: "archive", gz: "archive", rar: "archive",
  "7z": "archive", bz2: "archive", dmg: "archive", iso: "archive",
  // Fonts
  ttf: "font", otf: "font", woff: "font", woff2: "font",
  // Executables
  exe: "executable", app: "executable", msi: "executable",
  deb: "executable", rpm: "executable",
};

function getFileCategory(filename: string): FileCategory {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_MAP[ext] ?? "generic";
}

function DocumentIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

function SpreadsheetIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <line x1="8" y1="16" x2="16" y2="16" />
      <line x1="12" y1="10" x2="12" y2="18" />
    </svg>
  );
}

function PresentationIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2 3h20v14H2z" />
      <polygon points="10 8 15 10.5 10 13 10 8" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <line x1="8" y1="21" x2="16" y2="21" />
    </svg>
  );
}

function PdfIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M9 15v-2h1.5a1.5 1.5 0 0 0 0-3H9v5" />
    </svg>
  );
}

function ImageIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function VideoIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="4" width="15" height="16" rx="2" />
      <polygon points="22 8 17 12 22 16 22 8" />
    </svg>
  );
}

function AudioIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

function CodeIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
      <line x1="14" y1="4" x2="10" y2="20" />
    </svg>
  );
}

function ArchiveIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 8v13H3V8" />
      <path d="M1 3h22v5H1z" />
      <path d="M10 12h4" />
    </svg>
  );
}

function FontIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="4 7 4 4 20 4 20 7" />
      <line x1="9" y1="20" x2="15" y2="20" />
      <line x1="12" y1="4" x2="12" y2="20" />
    </svg>
  );
}

function ExecutableIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <polyline points="7 12 10 15 7 18" />
      <line x1="13" y1="18" x2="18" y2="18" />
    </svg>
  );
}

function GenericFileIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

export function FileTypeIcon({ filename, size = 20, className }: { filename: string; size?: number; className?: string }) {
  const category = getFileCategory(filename);
  const props = { size, className };

  switch (category) {
    case "document": return <DocumentIcon {...props} />;
    case "spreadsheet": return <SpreadsheetIcon {...props} />;
    case "presentation": return <PresentationIcon {...props} />;
    case "pdf": return <PdfIcon {...props} />;
    case "image": return <ImageIcon {...props} />;
    case "video": return <VideoIcon {...props} />;
    case "audio": return <AudioIcon {...props} />;
    case "code": return <CodeIcon {...props} />;
    case "archive": return <ArchiveIcon {...props} />;
    case "font": return <FontIcon {...props} />;
    case "executable": return <ExecutableIcon {...props} />;
    default: return <GenericFileIcon {...props} />;
  }
}
