import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { GrepSearchResult, TagSearchResult } from "../api";
import { ChevronLeftIcon } from "./shared/Icons";

interface SearchViewProps {
  query: string;
  selectedTags: string[];
  searchResultType: "grep" | "tag";
  grepResults: GrepSearchResult[];
  tagResults: TagSearchResult[];
  onSelectApp: (app: string) => void;
  isMobile: boolean;
}

export function SearchView({
  query,
  selectedTags,
  searchResultType,
  grepResults,
  tagResults,
  onSelectApp,
  isMobile,
}: SearchViewProps) {
  const [selectedItem, setSelectedItem] = useState<{
    app: string;
    file: string;
    matches: { line: number; text: string }[];
  } | null>(null);

  if (searchResultType === "tag") {
    return (
      <TagResultsView
        query={query}
        selectedTags={selectedTags}
        results={tagResults}
        onSelectApp={onSelectApp}
        isMobile={isMobile}
      />
    );
  }

  return (
    <GrepResultsView
      query={query}
      selectedTags={selectedTags}
      results={grepResults}
      selectedItem={selectedItem}
      onSelectItem={setSelectedItem}
      onSelectApp={onSelectApp}
      isMobile={isMobile}
    />
  );
}

function SearchHeader({
  query,
  selectedTags,
  resultCount,
  suffix,
}: {
  query: string;
  selectedTags: string[];
  resultCount: number;
  suffix: string;
}) {
  const parts: string[] = [];
  if (query) parts.push(`全文: "${query}"`);
  if (selectedTags.length > 0) parts.push(`タグ: ${selectedTags.join(", ")}`);
  return (
    <p className="text-xs text-gray-500 mb-4">
      {parts.join(" + ")} - {resultCount}
      {suffix}
    </p>
  );
}

function TagResultsView({
  query,
  selectedTags,
  results,
  onSelectApp,
  isMobile,
}: {
  query: string;
  selectedTags: string[];
  results: TagSearchResult[];
  onSelectApp: (app: string) => void;
  isMobile: boolean;
}) {
  if (results.length === 0) {
    return <EmptyState query={selectedTags.join(", ") || query} type="tag" />;
  }

  return (
    <motion.div
      className={`h-full overflow-y-auto dark-scrollbar ${isMobile ? "p-4 pb-32" : "p-6 pb-16"}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <SearchHeader
        query={query}
        selectedTags={selectedTags}
        resultCount={results.length}
        suffix="件のアプリ"
      />
      <div className="space-y-3">
        {results.map((r) => (
          <motion.button
            type="button"
            key={r.app}
            className="w-full text-left p-4 rounded-xl border border-gray-700/50 bg-gray-800/60 hover:border-indigo-500/50 transition-colors"
            whileHover={{ y: -1 }}
            onClick={() => onSelectApp(r.app)}
          >
            <h3 className="text-sm font-semibold text-gray-200">{r.app}</h3>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {r.tags.map((tag) => (
                <span
                  key={tag}
                  className={`inline-flex px-2 py-0.5 rounded-md text-[12px] font-medium ${
                    r.matchedTags.includes(tag)
                      ? "bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/30"
                      : "bg-gray-700/50 text-gray-400"
                  }`}
                >
                  {tag}
                </span>
              ))}
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

function GrepResultsView({
  query,
  selectedTags,
  results,
  selectedItem,
  onSelectItem,
  onSelectApp,
  isMobile,
}: {
  query: string;
  selectedTags: string[];
  results: GrepSearchResult[];
  selectedItem: { app: string; file: string; matches: { line: number; text: string }[] } | null;
  onSelectItem: (
    item: { app: string; file: string; matches: { line: number; text: string }[] } | null,
  ) => void;
  onSelectApp: (app: string) => void;
  isMobile: boolean;
}) {
  const totalMatches = results.reduce(
    (sum, r) => sum + r.files.reduce((s, f) => s + f.matches.length, 0),
    0,
  );

  if (results.length === 0) {
    return <EmptyState query={query} type="grep" />;
  }

  if (isMobile) {
    return (
      <div className="h-full overflow-y-auto dark-scrollbar p-4 pb-32">
        <SearchHeader
          query={query}
          selectedTags={selectedTags}
          resultCount={totalMatches}
          suffix="件のマッチ"
        />
        {selectedItem ? (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-indigo-400 mb-3"
              onClick={() => onSelectItem(null)}
            >
              <ChevronLeftIcon className="size-3" />
              戻る
            </button>
            <DetailPane item={selectedItem} query={query} />
          </motion.div>
        ) : (
          <ResultList
            results={results}
            query={query}
            onSelectItem={(app, file, matches) => onSelectItem({ app, file, matches })}
            onSelectApp={onSelectApp}
          />
        )}
      </div>
    );
  }

  // Desktop: 2-pane layout
  return (
    <div className="flex h-full">
      <div className="flex-1 min-w-0 overflow-y-auto dark-scrollbar p-6 border-r border-gray-700/50">
        <SearchHeader
          query={query}
          selectedTags={selectedTags}
          resultCount={totalMatches}
          suffix="件のマッチ"
        />
        <ResultList
          results={results}
          query={query}
          selectedItem={selectedItem}
          onSelectItem={(app, file, matches) => onSelectItem({ app, file, matches })}
          onSelectApp={onSelectApp}
        />
      </div>
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            className="flex-1 min-w-0 overflow-y-auto dark-scrollbar p-6"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "50%", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <DetailPane item={selectedItem} query={query} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ResultList({
  results,
  query,
  selectedItem,
  onSelectItem,
  onSelectApp,
}: {
  results: GrepSearchResult[];
  query: string;
  selectedItem?: { app: string; file: string } | null;
  onSelectItem: (app: string, file: string, matches: { line: number; text: string }[]) => void;
  onSelectApp: (app: string) => void;
}) {
  return (
    <div className="space-y-4">
      {results.map((r) => (
        <div key={r.app}>
          <button
            type="button"
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 mb-2 flex items-center gap-1"
            onClick={() => onSelectApp(r.app)}
          >
            <svg
              className="size-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
            {r.app}
          </button>
          <div className="space-y-1.5 ml-4">
            {r.files.map((f) => {
              const isSelected = selectedItem?.app === r.app && selectedItem?.file === f.file;
              return (
                <button
                  type="button"
                  key={f.file}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    isSelected
                      ? "border-indigo-500/50 bg-indigo-950/30"
                      : "border-gray-700/50 bg-gray-800/40 hover:border-gray-600/50"
                  }`}
                  onClick={() => onSelectItem(r.app, f.file, f.matches)}
                >
                  <p className="text-xs font-medium text-gray-300">{f.file}</p>
                  <p className="text-[12px] text-gray-500 mt-1">{f.matches.length}件のマッチ</p>
                  <p className="text-[12px] text-gray-400 mt-1 truncate">
                    <HighlightText text={f.matches[0]?.text ?? ""} query={query} />
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function DetailPane({
  item,
  query,
}: {
  item: { app: string; file: string; matches: { line: number; text: string }[] };
  query: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-300 mb-1">{item.app}</p>
      <p className="text-[12px] text-gray-500 mb-4">{item.file}</p>
      <div className="space-y-1">
        {item.matches.map((m) => (
          <div
            key={`${m.line}`}
            className="flex gap-3 px-3 py-2 rounded-lg bg-gray-800/50 border border-gray-700/30"
          >
            <span className="text-[12px] text-gray-600 font-mono shrink-0 select-none w-8 text-right">
              {m.line}
            </span>
            <span className="text-xs text-gray-300 break-all">
              <HighlightText text={m.text} query={query} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            // biome-ignore lint/suspicious/noArrayIndexKey: static split result
            key={i}
            className="bg-yellow-500/30 text-yellow-200 rounded-sm px-0.5"
          >
            {part}
          </mark>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: static split result
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function EmptyState({ query, type }: { query: string; type: "grep" | "tag" }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <div className="size-12 mx-auto mb-3 rounded-full bg-gray-800 flex items-center justify-center">
          <svg
            className="size-6 text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
        </div>
        <p className="text-sm text-gray-500">
          {type === "grep" ? "全文検索" : "タグ検索"}: &quot;{query}&quot;
        </p>
        <p className="text-xs text-gray-600 mt-1">結果が見つかりませんでした</p>
      </div>
    </div>
  );
}
