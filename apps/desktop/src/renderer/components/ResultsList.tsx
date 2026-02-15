import { memo, useEffect, useMemo, useRef, useState } from "react";
import { ClockIcon, FileIcon } from "./Icons";
import type { ResultItem } from "../types";

const ROW_HEIGHT = 152;
const OVERSCAN = 8;

interface ResultsListProps {
  items: ResultItem[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onOpen: (item: ResultItem) => void;
}

export const ResultsList = memo(function ResultsList({
  items,
  selectedIndex,
  onSelect,
  onOpen,
}: ResultsListProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const onScroll = () => setScrollTop(node.scrollTop);
    const onResize = () => setViewportHeight(node.clientHeight);

    onResize();
    node.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      node.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || selectedIndex < 0 || selectedIndex >= items.length) return;

    const top = selectedIndex * ROW_HEIGHT;
    const bottom = top + ROW_HEIGHT;
    if (top < node.scrollTop) {
      node.scrollTop = top;
    } else if (bottom > node.scrollTop + node.clientHeight) {
      node.scrollTop = bottom - node.clientHeight;
    }
  }, [selectedIndex, items.length]);

  const { startIndex, endIndex, totalHeight } = useMemo(() => {
    const visibleCount = Math.ceil(viewportHeight / ROW_HEIGHT);
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const end = Math.min(items.length, start + visibleCount + OVERSCAN * 2);
    return {
      startIndex: start,
      endIndex: end,
      totalHeight: items.length * ROW_HEIGHT,
    };
  }, [items.length, scrollTop, viewportHeight]);

  const visibleItems = items.slice(startIndex, endIndex);

  return (
    <div className="results-shell" ref={containerRef} role="listbox" aria-label="Search results">
      <div className="results-inner" style={{ height: totalHeight }}>
        {visibleItems.map((item, offset) => {
          const index = startIndex + offset;
          return (
            <button
              key={item.id}
              role="option"
              aria-selected={selectedIndex === index}
              className={`result-card ${selectedIndex === index ? "is-selected" : ""}`}
              style={{ transform: `translateY(${index * ROW_HEIGHT}px)` }}
              onMouseEnter={() => onSelect(index)}
              onFocus={() => onSelect(index)}
              onClick={() => onOpen(item)}
            >
              <div className="result-top-row">
                <div className="result-title-wrap">
                  <FileIcon size={16} className="result-file-icon" />
                  <div className="result-title-cluster">
                    <div className="result-title">{item.fileName}</div>
                    <div className="result-path" title={item.filePath}>
                      {item.filePath}
                    </div>
                  </div>
                </div>
                <div className="result-meta-right">
                  <span className="file-type-badge">{item.fileType || "file"}</span>
                  <span className="rank-chip">#{item.rank}</span>
                </div>
              </div>

              <p className="result-summary">{item.summary}</p>

              <div className="result-footer">
                <span className="result-footer-item">
                  <ClockIcon size={13} />
                  {item.modifiedLabel}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});
