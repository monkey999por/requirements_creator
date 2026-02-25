import { motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import {
  createQueueItem,
  deleteQueueItem,
  executeQueueItem,
  fetchDoneQueueItems,
  fetchQueueItems,
  type QueueItem,
  restoreQueueItem,
  updateQueueItem,
} from "../api";
import { useMessageToast } from "../hooks/useMessageToast";
import { BackButton } from "./shared/BackButton";
import { CreateButton } from "./shared/CreateButton";
import { EmptyState } from "./shared/EmptyState";
import { RestoreIcon, TrashIcon } from "./shared/Icons";
import { LoadingSpinner } from "./shared/LoadingSpinner";
import { MessageToast } from "./shared/MessageToast";

type QueueTab = "wait" | "done";

function pushQueueUrl(queueItem?: string | null, queueTab?: QueueTab | null) {
  const url = new URL(window.location.href);
  url.searchParams.set("view", "queue");
  // queueTab が明示的に渡された場合はそれを使い、渡されなかったら現在のURLから保持
  const effectiveTab = queueTab !== undefined ? queueTab : getQueueTabFromUrl();
  if (effectiveTab && effectiveTab !== "wait") {
    url.searchParams.set("queueTab", effectiveTab);
  } else {
    url.searchParams.delete("queueTab");
  }
  if (queueItem) {
    url.searchParams.set("queueItem", queueItem);
  } else {
    url.searchParams.delete("queueItem");
  }
  window.history.pushState({}, "", url.toString());
}

function getQueueItemFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get("queueItem");
}

function getQueueTabFromUrl(): QueueTab {
  const t = new URLSearchParams(window.location.search).get("queueTab");
  return t === "done" ? "done" : "wait";
}

export function QueueManager({ isMobile, isDev }: { isMobile: boolean; isDev: boolean }) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [doneItems, setDoneItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(() => getQueueItemFromUrl());
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<QueueTab>(() => getQueueTabFromUrl());
  const { message, showMessage } = useMessageToast();

  const reload = useCallback(() => {
    Promise.all([fetchQueueItems(), fetchDoneQueueItems()])
      .then(([wait, done]) => {
        setItems(wait);
        setDoneItems(done);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // ブラウザバック/フォワード対応
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("view") !== "queue") return;
      setTab(getQueueTabFromUrl());
      const queueItem = params.get("queueItem");
      if (queueItem === "__new__") {
        setCreating(true);
        setSelected(null);
      } else {
        setCreating(false);
        setSelected(queueItem);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const selectedItem =
    tab === "wait"
      ? items.find((i) => i.id === selected)
      : doneItems.find((i) => i.id === selected);

  const handleCreate = useCallback(
    async (title: string, content: string) => {
      const result = await createQueueItem(title, content);
      if (result.success && result.item) {
        setCreating(false);
        reload();
        setSelected(result.item.id);
        pushQueueUrl(result.item.id);
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
        reload();
        showMessage("更新しました");
      } else {
        showMessage(result.error ?? "更新エラー");
      }
    },
    [reload, showMessage],
  );

  const handleExecute = useCallback(
    async (id: string) => {
      const target = items.find((i) => i.id === id);
      const label = target ? `「${target.title}」` : "このアイテム";
      if (
        !window.confirm(
          `${label}のパイプラインを即時実行しますか？\nバックグラウンドで実行されます。`,
        )
      )
        return;
      const result = await executeQueueItem(id);
      if (result.success) {
        showMessage(result.message ?? "パイプラインを開始しました");
      } else {
        showMessage(result.error ?? "実行エラー");
      }
    },
    [items, showMessage],
  );

  const handleRestore = useCallback(
    async (id: string) => {
      const target = doneItems.find((i) => i.id === id);
      const label = target ? `「${target.title}」` : "このアイテム";
      if (!window.confirm(`${label}をWAITキューに復元しますか？`)) return;
      const result = await restoreQueueItem(id);
      if (result.success) {
        setSelected(null);
        pushQueueUrl(null);
        reload();
        showMessage("WAITキューに復元しました");
      } else {
        showMessage(result.error ?? "復元エラー");
      }
    },
    [doneItems, reload, showMessage],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const target = items.find((i) => i.id === id);
      const label = target ? `「${target.title}」` : "このアイテム";
      if (!window.confirm(`${label}を削除しますか？`)) return;
      await deleteQueueItem(id);
      if (selected === id) {
        setSelected(null);
        pushQueueUrl(null);
      }
      reload();
      showMessage("削除しました");
    },
    [items, selected, reload, showMessage],
  );

  const handleTabChange = useCallback((newTab: QueueTab) => {
    setTab(newTab);
    setSelected(null);
    setCreating(false);
    pushQueueUrl(null, newTab);
  }, []);

  if (loading) {
    return <LoadingSpinner />;
  }

  const currentItems = tab === "wait" ? items : doneItems;

  /* Mobile layout */
  if (isMobile) {
    if (tab === "wait" && creating) {
      return (
        <motion.div
          className="flex flex-col h-full"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
        >
          <QueueForm
            key="__new__"
            onSubmit={handleCreate}
            onCancel={() => {
              setCreating(false);
              pushQueueUrl(null);
            }}
            isMobile
          />
          <MessageToast message={message} />
        </motion.div>
      );
    }
    if (selectedItem) {
      if (tab === "done") {
        return (
          <motion.div
            className="flex flex-col h-full"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25 }}
          >
            <QueueDetailView
              item={selectedItem}
              onBack={() => {
                setSelected(null);
                pushQueueUrl(null);
              }}
              onRestore={isDev ? () => handleRestore(selectedItem.id) : undefined}
              isMobile
            />
            <MessageToast message={message} />
          </motion.div>
        );
      }
      return (
        <motion.div
          className="flex flex-col h-full"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
        >
          <QueueForm
            key={selectedItem.id}
            item={selectedItem}
            onSubmit={(title, content) => handleUpdate(selectedItem.id, title, content)}
            onCancel={() => {
              setSelected(null);
              pushQueueUrl(null);
            }}
            onExecute={isDev ? () => handleExecute(selectedItem.id) : undefined}
            isMobile
          />
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
          <QueueTabs
            tab={tab}
            onTabChange={handleTabChange}
            waitCount={items.length}
            doneCount={doneItems.length}
          />
          <div className="flex-1" />
          {tab === "wait" && isDev && (
            <CreateButton
              onClick={() => {
                setCreating(true);
                setSelected(null);
                pushQueueUrl("__new__");
              }}
              title="新規キューアイテム作成"
              hoverClassName="hover:text-orange-400 hover:bg-orange-500/10"
            />
          )}
        </div>
        <div className="flex-1 overflow-y-auto dark-scrollbar p-4 pb-32 bg-gray-900">
          <QueueList
            items={currentItems}
            selected={selected}
            onSelect={(id) => {
              setSelected(id);
              pushQueueUrl(id);
            }}
            onDelete={tab === "wait" ? handleDelete : undefined}
            onRestore={tab === "done" && isDev ? handleRestore : undefined}
            isDev={isDev}
            isDone={tab === "done"}
            isMobile
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
          <div className="py-1.5">
            <QueueTabs
              tab={tab}
              onTabChange={handleTabChange}
              waitCount={items.length}
              doneCount={doneItems.length}
            />
          </div>
          <div className="flex-1" />
          {tab === "wait" && isDev && (
            <CreateButton
              onClick={() => {
                setCreating(true);
                setSelected(null);
                pushQueueUrl("__new__");
              }}
              title="新規キューアイテム作成"
              hoverClassName="hover:text-orange-400 hover:bg-orange-500/10"
            />
          )}
        </div>
        <div className="flex-1 overflow-y-auto dark-scrollbar p-3 bg-gray-900">
          <QueueList
            items={currentItems}
            selected={selected}
            onSelect={(id) => {
              setSelected(id);
              setCreating(false);
              pushQueueUrl(id);
            }}
            onDelete={tab === "wait" ? handleDelete : undefined}
            onRestore={tab === "done" && isDev ? handleRestore : undefined}
            isDev={isDev}
            isDone={tab === "done"}
          />
        </div>
      </div>

      {/* Right: detail / form */}
      <div className="flex-1 flex flex-col min-w-0">
        {tab === "wait" && creating ? (
          <QueueForm
            key="__new__"
            onSubmit={handleCreate}
            onCancel={() => {
              setCreating(false);
              pushQueueUrl(null);
            }}
          />
        ) : tab === "wait" && selectedItem ? (
          <QueueForm
            key={selectedItem.id}
            item={selectedItem}
            onSubmit={(title, content) => handleUpdate(selectedItem.id, title, content)}
            onCancel={() => {
              setSelected(null);
              pushQueueUrl(null);
            }}
            onExecute={isDev ? () => handleExecute(selectedItem.id) : undefined}
          />
        ) : tab === "done" && selectedItem ? (
          <QueueDetailView
            item={selectedItem}
            onBack={() => {
              setSelected(null);
              pushQueueUrl(null);
            }}
            onRestore={isDev ? () => handleRestore(selectedItem.id) : undefined}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-500 text-sm">
            {tab === "wait"
              ? items.length === 0
                ? "キューにアイデアを追加して、定期実行で要件を自動生成しましょう"
                : "キューアイテムを選択してください"
              : doneItems.length === 0
                ? "完了済みのアイテムはありません"
                : "完了済みアイテムを選択してください"}
          </div>
        )}
      </div>
      <MessageToast message={message} />
    </motion.div>
  );
}

function QueueTabs({
  tab,
  onTabChange,
  waitCount,
  doneCount,
}: {
  tab: QueueTab;
  onTabChange: (tab: QueueTab) => void;
  waitCount: number;
  doneCount: number;
}) {
  return (
    <div className="flex gap-1 shrink-0">
      <button
        type="button"
        className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
          tab === "wait"
            ? "bg-orange-500/15 text-orange-400"
            : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]"
        }`}
        onClick={() => onTabChange("wait")}
      >
        WAIT{waitCount > 0 && ` (${waitCount})`}
      </button>
      <button
        type="button"
        className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
          tab === "done"
            ? "bg-emerald-500/15 text-emerald-400"
            : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]"
        }`}
        onClick={() => onTabChange("done")}
      >
        DONE{doneCount > 0 && ` (${doneCount})`}
      </button>
    </div>
  );
}

function QueueList({
  items,
  selected,
  onSelect,
  onDelete,
  onRestore,
  isDev,
  isDone,
  isMobile,
}: {
  items: QueueItem[];
  selected: string | null;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
  onRestore?: (id: string) => void;
  isDev: boolean;
  isDone?: boolean;
  isMobile?: boolean;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={
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
        }
        message={isDone ? "完了済みのアイテムはありません" : "キューは空です"}
        submessage={
          isDone
            ? "パイプライン実行が完了するとここに表示されます"
            : "アプリのアイデアを追加して定期実行に備えましょう"
        }
      />
    );
  }

  const selectedColor = isDone
    ? "bg-emerald-500/15 text-emerald-400"
    : "bg-orange-500/15 text-orange-400";
  const selectedIconColor = isDone ? "text-emerald-400" : "text-orange-400";

  return (
    <div className="space-y-1">
      {items.map((item) => (
        <button
          type="button"
          key={item.id}
          className={`
            group w-full flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-colors
            ${selected === item.id ? selectedColor : "text-gray-400 hover:bg-white/[0.04] hover:text-gray-200"}
          `}
          onClick={() => onSelect(item.id)}
        >
          {isDone ? (
            <svg
              aria-hidden="true"
              className={`size-4 shrink-0 ${selected === item.id ? selectedIconColor : "text-gray-600"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
          ) : (
            <svg
              aria-hidden="true"
              className={`size-4 shrink-0 ${selected === item.id ? selectedIconColor : "text-gray-600"}`}
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
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-medium truncate">{item.title}</p>
            <p className="text-[11px] text-gray-600 truncate">
              {new Date(item.createdAt).toLocaleDateString("ja-JP")}
            </p>
          </div>
          {isDev && onRestore && (
            <button
              type="button"
              className={`p-1.5 rounded-lg text-gray-700 hover:text-orange-400 hover:bg-orange-400/10 transition-all shrink-0 ${isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
              onClick={(e) => {
                e.stopPropagation();
                onRestore(item.id);
              }}
              title="WAITに復元"
            >
              <RestoreIcon className="size-4" />
            </button>
          )}
          {isDev && onDelete && (
            <button
              type="button"
              className={`p-1.5 rounded-lg text-gray-700 hover:text-red-400 hover:bg-red-400/10 transition-all shrink-0 ${isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item.id);
              }}
              title="削除"
            >
              <TrashIcon className="size-4" />
            </button>
          )}
        </button>
      ))}
    </div>
  );
}

function QueueForm({
  item,
  onSubmit,
  onCancel,
  onExecute,
  isMobile,
}: {
  item?: QueueItem;
  onSubmit: (title: string, content: string) => void;
  onCancel: () => void;
  onExecute?: () => void;
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
        {isMobile && <BackButton onClick={onCancel} />}
        <span className="px-3 py-2.5 text-xs font-medium text-orange-400">
          {isEdit ? "キューアイテム編集" : "新規キューアイテム"}
        </span>
        <div className="flex-1" />
        {isEdit && onExecute && (
          <button
            type="button"
            className="px-3 py-1.5 my-1 text-xs font-medium rounded-lg transition-colors bg-emerald-600 text-white hover:bg-emerald-500 flex items-center gap-1"
            onClick={onExecute}
            title="パイプラインを即時実行"
          >
            <svg aria-hidden="true" className="size-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            実行
          </button>
        )}
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
      <div
        className={`flex-1 flex flex-col overflow-hidden p-6 ${isMobile ? "pb-32" : ""} bg-gray-900 gap-4`}
      >
        <div className="shrink-0">
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
        <div className="flex-1 flex flex-col min-h-0">
          <label
            className="block text-[11px] font-medium text-gray-500 mb-1.5 shrink-0"
            htmlFor="q-content"
          >
            内容
          </label>
          <textarea
            id="q-content"
            className="w-full flex-1 px-3 py-2 text-sm bg-gray-800 border border-gray-700/50 rounded-lg text-gray-200 placeholder-gray-600 outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 resize-none"
            placeholder="アプリのアイデアを自由に記述してください。箇条書きでも文章でもOKです。"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>
      </div>
    </motion.div>
  );
}

function QueueDetailView({
  item,
  onBack,
  onRestore,
  isMobile,
}: {
  item: QueueItem;
  onBack: () => void;
  onRestore?: () => void;
  isMobile?: boolean;
}) {
  return (
    <motion.div
      className="flex flex-col h-full"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-center gap-2 px-4 bg-gray-800/50 border-b border-gray-700/50 shrink-0">
        {isMobile && <BackButton onClick={onBack} />}
        <span className="px-3 py-2.5 text-xs font-medium text-emerald-400">完了済みアイテム</span>
        <div className="flex-1" />
        {onRestore && (
          <button
            type="button"
            className="px-3 py-1.5 my-1 text-xs font-medium rounded-lg transition-colors bg-orange-600 text-white hover:bg-orange-500 flex items-center gap-1.5"
            onClick={onRestore}
            title="WAITキューに復元"
          >
            <RestoreIcon className="size-3.5" />
            WAITに復元
          </button>
        )}
      </div>
      <div
        className={`flex-1 flex flex-col overflow-hidden p-6 ${isMobile ? "pb-32" : ""} bg-gray-900 gap-4`}
      >
        <div className="shrink-0">
          <span className="block text-[11px] font-medium text-gray-500 mb-1.5">タイトル</span>
          <p className="px-3 py-2 text-sm bg-gray-800/50 border border-gray-700/30 rounded-lg text-gray-300">
            {item.title}
          </p>
        </div>
        <div className="flex-1 flex flex-col min-h-0">
          <span className="block text-[11px] font-medium text-gray-500 mb-1.5 shrink-0">内容</span>
          <div className="flex-1 px-3 py-2 text-sm bg-gray-800/50 border border-gray-700/30 rounded-lg text-gray-300 overflow-y-auto dark-scrollbar whitespace-pre-wrap">
            {item.content}
          </div>
        </div>
        <div className="shrink-0">
          <span className="block text-[11px] font-medium text-gray-500 mb-1">作成日時</span>
          <p className="text-xs text-gray-400">
            {new Date(item.createdAt).toLocaleString("ja-JP")}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
