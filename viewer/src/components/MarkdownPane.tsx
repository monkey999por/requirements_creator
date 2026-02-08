import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownPaneProps {
  content: string;
}

export function MarkdownPane({ content }: MarkdownPaneProps) {
  if (!content) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 w-48 bg-gray-100 rounded-md" />
        <div className="h-4 w-full bg-gray-100 rounded-md" />
        <div className="h-4 w-5/6 bg-gray-100 rounded-md" />
        <div className="h-4 w-4/6 bg-gray-100 rounded-md" />
        <div className="h-20 w-full bg-gray-50 rounded-md mt-6" />
        <div className="h-4 w-full bg-gray-100 rounded-md" />
        <div className="h-4 w-3/4 bg-gray-100 rounded-md" />
      </div>
    );
  }

  return (
    <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-h1:text-xl prose-h1:border-b prose-h1:border-gray-200 prose-h1:pb-3 prose-h2:text-base prose-h2:mt-8 prose-h3:text-sm prose-p:text-gray-600 prose-a:text-indigo-600 prose-a:no-underline hover:prose-a:underline prose-code:text-indigo-700 prose-code:bg-indigo-50 prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 prose-code:before:content-none prose-code:after:content-none prose-pre:bg-gray-900 prose-pre:rounded-xl prose-th:bg-gray-50 prose-th:text-xs prose-th:font-semibold prose-td:text-xs">
      <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
    </div>
  );
}
