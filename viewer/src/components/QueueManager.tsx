import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import {
  createQueueItem,
  deleteQueueItem,
  fetchQueueItems,
  type QueueItem,
  updateQueueItem,
} from "../api";

export function QueueManager({ isMobile, isDev }: { isMobile: boolean; isDev: boolean }) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(() => {
    fetchQueueItems()
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const selectedItem = items.find((i) => i.id === selected);

  const showMessage = useCallback((msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 3000);
  }, []);

  const handleCreate = useCallback(
    async (title: string, content: string) => {
      const result = await createQueueItem(title, content);
      if (result.success && result.item) {
        setCreating(false);
        reload();
        setSelected(result.item.id);
        showMessage("キューに追加しました");
      } else {
        showMessage(result.error ?? "作成エラー");
      }
    },
    [reload, showMessage],
  );

  const handleUpdate = useCallback(
    async (id: string, title: string, content: string) => {
      const result = await updateQueueItem(id, { title, content });
      if (result.success) {
        setEditing(false);
        reload();
        showMessage("更新しました");
      } else {
        showMessage(result.error ?? "更新エラー");
      }
    },
    [reload, showMessage],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteQueueItem(id);
      if (selected === id) setSelected(null);
      setEditing(false);
      reload();
      showMessage("削除しました");
    },
    [selected, reload, showMessage],
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <motion.div
          className="flex flex-col items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="size-8 rounded-full border-2 border-indigo-800 border-t-indigo-400"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
          />
          <p className="text-xs text-gray-500">読み込み中...</p>
        </motion.div>
      </div>
    );
  }

  /* Mobile layout */
  if (isMobile) {
    if (creating) {
      return (
        <motion.div
          className="flex flex-col h-full"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
        >
          <QueueForm onSubmit={handleCreate} onCancel={() => setCreating(false)} isMobile />
          <MessageToast message={message} />
        </motion.div>
      );
    }
    if (selectedItem && editing) {
      return (
        <motion.div
          className="flex flex-col h-full"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
        >
          <QueueForm
            item={selectedItem}
            onSubmit={(title, content) => handleUpdate(selectedItem.id, title, content)}
            onCancel={() => setEditing(false)}
            isMobile
          />
          <MessageToast message={message} />
        </motion.div>
      );
    }
    if (selectedItem) {
      return (
        <motion.div
          className="flex flex-col h-full"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
        >
          <QueueDetailHeader
            item={selectedItem}
            onBack={() => setSelected(null)}
            onEdit={() => setEditing(true)}
            onDelete={() => handleDelete(selectedItem.id)}
            isDev={isDev}
            isMobile
          />
          <QueueDetailContent item={selectedItem} />
          <MessageToast message={message} />
        </motion.div>
      );
    }
    return (
      <motion.div
        className="flex flex-col h-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
          <h2 className="text-sm font-semibold text-gray-200">パイプラインキュー</h2>
          <div className="flex-1" />
          {isDev && <CreateButton onClick={() => setCreating(true)} />}
        </div>
        <div className="flex-1 overflow-y-auto dark-scrollbar p-4 pb-32 bg-gray-900">
          <QueueList
            items={items}
            selected={selected}
            onSelect={setSelected}
            onDelete={handleDelete}
            isDev={isDev}
          />
        </div>
        <MessageToast message={message} />
      </motion.div>
    );
  }

  /* Desktop layout */
  return (
    <motion.div
      className="flex h-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Left: queue list */}
      <div className="w-72 flex flex-col border-r border-gray-700/50 shrink-0">
        <div className="flex items-center gap-2 px-4 bg-gray-800/50 border-b border-gray-700/50 shrink-0">
          <span className="px-3 py-2.5 text-xs font-medium text-orange-400">
            パイプラインキュー
          </span>
          <div className="flex-1" />
          {isDev && <CreateButton onClick={() => setCreating(true)} />}
        </div>
        <div className="flex-1 overflow-y-auto dark-scrollbar p-3 bg-gray-900">
          <QueueList
            items={items}
            selected={selected}
            onSelect={(id) => {
              setSelected(id);
              setEditing(false);
              setCreating(false);
            }}
            onDelete={handleDelete}
            isDev={isDev}
          />
        </div>
      </div>

      {/* Right: detail / form */}
      <div className="flex-1 flex flex-col min-w-0">
        {creating ? (
          <QueueForm onSubmit={handleCreate} onCancel={() => setCreating(false)} />
        ) : selectedItem && editing ? (
          <QueueForm
            item={selectedItem}
            onSubmit={(title, content) => handleUpdate(selectedItem.id, title, content)}
            onCancel={() => setEditing(false)}
          />
        ) : selectedItem ? (
          <>
            <QueueDetailHeader
              item={selectedItem}
              onEdit={() => setEditing(true)}
              onDelete={() => handleDelete(selectedItem.id)}
              isDev={isDev}
            />
            <QueueDetailContent item={selectedItem} />
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-gray-500 text-sm">
            {items.length === 0
              ? "キューにアイデアを追加して、定期実行で要件を自動生成しましょう"
              : "キューアイテムを選択してください"}
          </div>
        )}
      </div>
      <MessageToast message={message} />
    </motion.div>
  );
}

function CreateButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="p-1.5 rounded-lg text-gray-400 hover:text-orange-400 hover:bg-orange-500/10 transition-colors"
      onClick={onClick}
      title="新規キューアイテム作成"
    >
      <svg
        aria-hidden="true"
        className="size-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    </button>
  );
}

function QueueList({
  items,
  selected,
  onSelect,
  onDelete,
  isDev,
}: {
  items: QueueItem[];
  selected: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  isDev: boolean;
}) {
  if (items.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="size-12 mx-auto mb-3 rounded-full bg-gray-800 flex items-center justify-center">
          <svg
            aria-hidden="true"
            className="size-6 text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z"
            />
          </svg>
        </div>
        <p className="text-gray-600 text-xs">キューは空です</p>
        <p className="text-gray-700 text-[11px] mt-1">
          アプリのアイデアを追加して定期実行に備えましょう
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {items.map((item) => (
        <button
          type="button"
          key={item.id}
          className={`
            group w-full flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-colors
            ${selected === item.id ? "bg-orange-500/15 text-orange-400" : "text-gray-400 hover:bg-white/[0.04] hover:text-gray-200"}
          `}
          onClick={() => onSelect(item.id)}
        >
          <svg
            aria-hidden="true"
            className={`size-4 shrink-0 ${selected === item.id ? "text-orange-400" : "text-gray-600"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
            />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-medium truncate">{item.title}</p>
            <p className="text-[11px] text-gray-600 truncate">
              {new Date(item.createdAt).toLocaleDateString("ja-JP")}
            </p>
          </div>
          {isDev && (
            <button
              type="button"
              className="p-1 rounded-md text-gray-700 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item.id);
              }}
              title="削除"
            >
              <svg
                aria-hidden="true"
                className="size-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          )}
        </button>
      ))}
    </div>
  );
}

function QueueDetailHeader({
  item,
  onBack,
  onEdit,
  onDelete,
  isDev,
  isMobile,
}: {
  item: QueueItem;
  onBack?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isDev: boolean;
  isMobile?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-4 bg-gray-800/50 border-b border-gray-700/50 shrink-0">
      {isMobile && onBack && (
        <button
          type="button"
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 transition-colors"
          onClick={onBack}
        >
          <svg
            aria-hidden="true"
            className="size-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
      )}
      <span className="px-3 py-2.5 text-xs font-medium text-orange-400 truncate">{item.title}</span>
      <span className="text-[11px] text-gray-600 shrink-0">
        {new Date(item.createdAt).toLocaleDateString("ja-JP")}
      </span>
      <div className="flex-1" />
      {isDev && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
            onClick={onEdit}
            title="編集"
          >
            <svg
              aria-hidden="true"
              className="size-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
              />
            </svg>
          </button>
          <button
            type="button"
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
            onClick={onDelete}
            title="削除"
          >
            <svg
              aria-hidden="true"
              className="size-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

function QueueDetailContent({ item }: { item: QueueItem }) {
  return (
    <div className="flex-1 overflow-y-auto dark-scrollbar p-6 bg-gray-900">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="prose prose-invert prose-sm max-w-none">
          <pre className="whitespace-pre-wrap text-sm text-gray-300 bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
            {item.content}
          </pre>
        </div>
        <div className="mt-6 flex gap-4 text-[11px] text-gray-600">
          <span>作成: {new Date(item.createdAt).toLocaleString("ja-JP")}</span>
          {item.updatedAt !== item.createdAt && (
            <span>更新: {new Date(item.updatedAt).toLocaleString("ja-JP")}</span>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function QueueForm({
  item,
  onSubmit,
  onCancel,
  isMobile,
}: {
  item?: QueueItem;
  onSubmit: (title: string, content: string) => void;
  onCancel: () => void;
  isMobile?: boolean;
}) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [content, setContent] = useState(item?.content ?? "");
  const isEdit = !!item;

  return (
    <motion.div
      className="flex flex-col h-full"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-center gap-2 px-4 bg-gray-800/50 border-b border-gray-700/50 shrink-0">
        {isMobile && (
          <button
            type="button"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 transition-colors"
            onClick={onCancel}
          >
            <svg
              aria-hidden="true"
              className="size-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
        )}
        <span className="px-3 py-2.5 text-xs font-medium text-orange-400">
          {isEdit ? "キューアイテム編集" : "新規キューアイテム"}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          className="px-3 py-1.5 my-1 text-xs text-gray-400 hover:text-gray-200 transition-colors"
          onClick={onCancel}
        >
          キャンセル
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 my-1 text-xs font-medium rounded-lg transition-colors ${
            title.trim() && content.trim()
              ? "bg-orange-600 text-white hover:bg-orange-500"
              : "bg-gray-800 text-gray-600 cursor-not-allowed"
          }`}
          disabled={!title.trim() || !content.trim()}
          onClick={() => onSubmit(title, content)}
        >
          {isEdit ? "更新" : "追加"}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto dark-scrollbar p-6 bg-gray-900 space-y-4">
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1.5" htmlFor="q-title">
            タイトル
          </label>
          <input
            id="q-title"
            type="text"
            className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700/50 rounded-lg text-gray-200 placeholder-gray-600 outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20"
            placeholder="アプリのアイデア名"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="flex-1 flex flex-col">
          <label className="block text-[11px] font-medium text-gray-500 mb-1.5" htmlFor="q-content">
            内容
          </label>
          <textarea
            id="q-content"
            className="w-full flex-1 min-h-[200px] px-3 py-2 text-sm bg-gray-800 border border-gray-700/50 rounded-lg text-gray-200 placeholder-gray-600 outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 resize-y"
            placeholder="アプリのアイデアを自由に記述してください。箇条書きでも文章でもOKです。"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>
      </div>
    </motion.div>
  );
}

function MessageToast({ message }: { message: string | null }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-gray-700 text-sm text-gray-200 shadow-xl border border-gray-600"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.2 }}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
