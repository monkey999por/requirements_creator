import { motion } from "motion/react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
      <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
    </div>
  );
}
