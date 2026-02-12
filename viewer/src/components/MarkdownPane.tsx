import mermaid from "mermaid";
import { motion } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useZoomPan } from "../hooks/useZoomPan";

mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  themeVariables: {
    darkMode: true,
    background: "#111827",
    primaryColor: "#4338ca",
    primaryTextColor: "#e5e7eb",
    primaryBorderColor: "#6366f1",
    lineColor: "#6b7280",
    secondaryColor: "#1e1b4b",
    tertiaryColor: "#1f2937",
    noteBkgColor: "#1e1b4b",
    noteTextColor: "#e5e7eb",
    noteBorderColor: "#6366f1",
  },
});

// --- Shared zoom/pan canvas (receives pre-rendered SVG HTML) ---
function MermaidCanvas({
  svgHtml,
  className,
  alwaysPannable = false,
}: {
  svgHtml: string;
  className?: string;
  alwaysPannable?: boolean;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const { wrapperRef, contentRef, isZoomed, isPannable, reset, wrapperProps } = useZoomPan({
    alwaysPannable,
  });

  const prevSvgRef = useRef(svgHtml);
  useEffect(() => {
    if (prevSvgRef.current !== svgHtml) {
      prevSvgRef.current = svgHtml;
      reset();
    }
  }, [svgHtml, reset]);

  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      (contentRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      if (node) node.innerHTML = svgHtml;
    },
    [svgHtml, contentRef],
  );

  return (
    <div
      ref={wrapperRef}
      className={`mermaid-zoom-wrapper relative overflow-hidden ${className || ""}`}
      style={{ touchAction: isPannable ? "none" : "pan-y" }}
      {...wrapperProps}
      onPointerDown={(e) => {
        wrapperProps.onPointerDown(e);
        if (isPannable) setIsDragging(true);
      }}
      onPointerUp={(e) => {
        wrapperProps.onPointerUp(e);
        setIsDragging(false);
      }}
      onPointerCancel={(e) => {
        wrapperProps.onPointerCancel(e);
        setIsDragging(false);
      }}
    >
      <div
        ref={setRef}
        className={`mermaid-zoom-content mermaid-diagram flex justify-center ${
          isPannable ? (isDragging ? "cursor-grabbing" : "cursor-grab") : ""
        }`}
      />
      {isZoomed && (
        <div className="pointer-events-none absolute top-2 left-2 rounded-md bg-gray-900/80 px-2 py-1 text-xs text-gray-400">
          ダブルクリックでリセット
        </div>
      )}
    </div>
  );
}

// --- Fullscreen dialog ---
function MermaidFullscreenDialog({ svgHtml, onClose }: { svgHtml: string; onClose: () => void }) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const stopSwipePropagation = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col bg-gray-950/95"
      onPointerDown={stopSwipePropagation}
      onPointerMove={stopSwipePropagation}
      onPointerUp={stopSwipePropagation}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-xs text-gray-500">ESC で閉じる</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-200"
          title="閉じる"
        >
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="size-5"
          >
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>
      </div>
      <div className="flex flex-1 min-h-0 px-4 pb-4">
        <MermaidCanvas
          svgHtml={svgHtml}
          className="flex-1 min-h-0 rounded-xl border border-gray-700/50"
          alwaysPannable
        />
      </div>
    </div>,
    document.body,
  );
}

// --- Inline diagram with fullscreen trigger ---
function MermaidDiagram({ code }: { code: string }) {
  const [error, setError] = useState("");
  const [svgHtml, setSvgHtml] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const id = useId().replace(/:/g, "_");

  useEffect(() => {
    let cancelled = false;
    setSvgHtml("");
    setError("");
    mermaid
      .render(`mermaid${id}`, code)
      .then(({ svg }) => {
        if (!cancelled) setSvgHtml(svg);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [code, id]);

  if (error) {
    return (
      <div className="my-4 rounded-xl border border-red-900/50 bg-red-950/30 p-4">
        <pre className="text-xs text-gray-400 mb-2 overflow-x-auto">
          <code>{code}</code>
        </pre>
        <p className="text-sm text-red-400">Mermaid レンダリングエラー: {error}</p>
      </div>
    );
  }

  if (!svgHtml) return null;

  return (
    <>
      <div className="group relative my-4 rounded-xl border border-gray-700/50 overflow-hidden">
        <MermaidCanvas svgHtml={svgHtml} />
        <button
          type="button"
          onClick={() => setIsFullscreen(true)}
          className="absolute top-2 right-2 z-10 rounded-md bg-gray-900/70 p-1.5 text-gray-400 opacity-0 transition-all hover:bg-gray-800 hover:text-gray-200 group-hover:opacity-100"
          title="全画面表示"
        >
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4"
          >
            <path d="M3 8V3h5M17 8V3h-5M3 12v5h5M17 12v5h-5" />
          </svg>
        </button>
      </div>
      {isFullscreen && (
        <MermaidFullscreenDialog svgHtml={svgHtml} onClose={() => setIsFullscreen(false)} />
      )}
    </>
  );
}

interface MarkdownPaneProps {
  content: string;
}

const skeletonVariants = {
  pulse: {
    opacity: [0.4, 1, 0.4],
    transition: { duration: 1.5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" },
  },
};

export function MarkdownPane({ content }: MarkdownPaneProps) {
  if (!content) {
    return (
      <motion.div
        className="space-y-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {[
          "h-6 w-48 bg-gray-800 rounded-md",
          "h-4 w-full bg-gray-800 rounded-md",
          "h-4 w-5/6 bg-gray-800 rounded-md",
          "h-4 w-4/6 bg-gray-800 rounded-md",
          "h-20 w-full bg-gray-800/50 rounded-md mt-6",
          "h-4 w-full bg-gray-800 rounded-md",
          "h-4 w-3/4 bg-gray-800 rounded-md",
        ].map((cls) => (
          <motion.div key={cls} className={cls} variants={skeletonVariants} animate="pulse" />
        ))}
      </motion.div>
    );
  }

  return (
    <div className="prose prose-sm prose-invert max-w-none prose-headings:text-gray-100 prose-h1:text-xl prose-h1:border-b prose-h1:border-gray-700 prose-h1:pb-3 prose-h2:text-base prose-h2:mt-8 prose-h3:text-sm prose-p:text-gray-300 prose-a:text-indigo-400 prose-a:no-underline hover:prose-a:underline prose-code:text-indigo-300 prose-code:bg-indigo-950/50 prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 prose-code:before:content-none prose-code:after:content-none prose-pre:bg-gray-950 prose-pre:rounded-xl prose-th:bg-gray-800 prose-th:text-xs prose-th:font-semibold prose-th:text-gray-300 prose-td:text-xs prose-td:text-gray-300 prose-strong:text-gray-100 prose-li:text-gray-300 prose-hr:border-gray-700">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children }) {
            if (/language-mermaid/.test(className || "")) {
              return <MermaidDiagram code={String(children).trim()} />;
            }
            return <code className={className}>{children}</code>;
          },
          pre({ children }) {
            const child = Array.isArray(children) ? children[0] : children;
            if (
              child &&
              typeof child === "object" &&
              "props" in child &&
              /language-mermaid/.test(child.props?.className || "")
            ) {
              return <>{children}</>;
            }
            return <pre>{children}</pre>;
          },
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}
