import { useCallback, useEffect, useRef, useState } from "react";
import {
  abortCommand,
  type CommandEvent,
  commitAndPush,
  executeCommand,
  getGenBranch,
  switchGenBranch,
} from "../api";
import { useToast } from "./Toast";

// --- Types ---

interface LogEntry {
  id: number;
  type: CommandEvent["type"];
  text: string;
}

interface OptionDef {
  id: string;
  label: string;
  type: "select" | "checkbox" | "text" | "textarea";
  dynamicChoicesUrl?: string;
  argFlag?: string;
  positional?: boolean;
  placeholder?: string;
  required?: boolean;
  linkedOptionId?: string;
  fetchUrlPattern?: string;
  saveUrlPattern?: string;
  rows?: number;
}

interface CommandDef {
  id: string;
  label: string;
  description: string;
  options: OptionDef[];
}

// --- Command Definitions ---

const COMMANDS: CommandDef[] = [
  {
    id: "collect",
    label: "collect",
    description: "外部API（NewsAPI等）からトレンド情報を取得し、data_sourceに保存する。",
    options: [
      {
        id: "only",
        label: "ソース指定",
        type: "select",
        dynamicChoicesUrl: "/api/commands/collect-sources",
        argFlag: "--only",
      },
      {
        id: "dryRun",
        label: "dry-run（API呼び出しなしで確認）",
        type: "checkbox",
        argFlag: "--dry-run",
      },
    ],
  },
  {
    id: "extract",
    label: "extract",
    description: "収集データからキーワードを抽出し、keyword.jsonを生成する。",
    options: [
      {
        id: "target",
        label: "データソース",
        type: "select",
        dynamicChoicesUrl: "/api/commands/data-sources",
        argFlag: "--target",
      },
    ],
  },
  {
    id: "generate",
    label: "generate",
    description:
      "キーワードまたはテキストデータからアプリ案を構想し、要件定義を自動生成する。ダイレクトモードではキーワード抽出をスキップして直接生成。データセットモードでは既存要件の組み合わせから新アプリを生成。",
    options: [
      {
        id: "target",
        label: "データソース",
        type: "select",
        dynamicChoicesUrl: "/api/commands/data-sources",
        argFlag: "--target",
      },
      {
        id: "direct",
        label: "ダイレクトモード（キーワード抽出スキップ、テキストから直接生成）",
        type: "checkbox",
        argFlag: "--direct",
      },
      {
        id: "dataset",
        label: "データセット（データセットモード）",
        type: "select",
        dynamicChoicesUrl: "/api/commands/dataset-names",
        argFlag: "--dataset",
      },
      {
        id: "skipAgents",
        label: "外部エージェントをスキップ",
        type: "checkbox",
        argFlag: "--skip-agents",
      },
    ],
  },
  {
    id: "regenerate",
    label: "regenerate",
    description: "既存アプリ要件をmemo.mdの内容を最優先指示として再生成する。",
    options: [
      {
        id: "appName",
        label: "アプリ名",
        type: "select",
        dynamicChoicesUrl: "/api/commands/apps",
        positional: true,
        required: true,
      },
      {
        id: "memo",
        label: "メモ（memo.md）",
        type: "textarea",
        linkedOptionId: "appName",
        fetchUrlPattern: "/api/apps/{value}/memo",
        saveUrlPattern: "/api/apps/{value}/memo",
        rows: 8,
        placeholder: "アプリを選択するとmemo.mdが読み込まれます...",
      },
      {
        id: "skipAgents",
        label: "外部エージェントをスキップ",
        type: "checkbox",
        argFlag: "--skip-agents",
      },
    ],
  },
  {
    id: "validate",
    label: "validate",
    description: "生成された要件の構造・内容を自動検証する。未指定時は全アプリを検証。",
    options: [
      {
        id: "appName",
        label: "アプリ名（空で全て検証）",
        type: "select",
        dynamicChoicesUrl: "/api/commands/apps",
        positional: true,
      },
    ],
  },
  {
    id: "pipeline",
    label: "pipeline",
    description:
      "collect → extract → generate → validate を一括実行する。ダイレクトモードではextractをスキップしてテキストから直接生成。",
    options: [
      {
        id: "skipCollect",
        label: "collectをスキップ",
        type: "checkbox",
        argFlag: "--skip-collect",
      },
      {
        id: "skipExtract",
        label: "extractをスキップ",
        type: "checkbox",
        argFlag: "--skip-extract",
      },
      {
        id: "direct",
        label: "ダイレクトモード（extractスキップ、テキストから直接生成）",
        type: "checkbox",
        argFlag: "--direct",
      },
      {
        id: "source",
        label: "データソース指定",
        type: "select",
        dynamicChoicesUrl: "/api/commands/data-sources",
        argFlag: "--source",
      },
      {
        id: "dataset",
        label: "データセット",
        type: "select",
        dynamicChoicesUrl: "/api/commands/dataset-names",
        argFlag: "--dataset",
      },
      {
        id: "regenerateApp",
        label: "再生成対象アプリ",
        type: "select",
        dynamicChoicesUrl: "/api/commands/apps",
        argFlag: "--regenerate",
      },
      {
        id: "memo",
        label: "メモ（再生成時）",
        type: "text",
        argFlag: "--memo",
        placeholder: "改善指示を入力...",
      },
    ],
  },
];

// --- Helpers ---

function buildArgs(command: CommandDef, values: Record<string, string | boolean>): string[] {
  const positional: string[] = [];
  const flags: string[] = [];
  for (const opt of command.options) {
    // saveUrlPattern を持つオプションはファイル経由で渡すため args に含めない
    if (opt.saveUrlPattern) continue;
    const val = values[opt.id];
    if (opt.type === "checkbox" && val === true && opt.argFlag) {
      flags.push(opt.argFlag);
    } else if (
      (opt.type === "select" || opt.type === "text" || opt.type === "textarea") &&
      typeof val === "string" &&
      val
    ) {
      if (opt.positional) {
        positional.push(val);
      } else if (opt.argFlag) {
        flags.push(opt.argFlag, val);
      }
    }
  }
  return [...positional, ...flags];
}

// --- Component ---

interface CommandRunnerProps {
  isMobile: boolean;
  isDev: boolean;
}

export function CommandRunner({ isMobile, isDev }: CommandRunnerProps) {
  const [selectedCommandId, setSelectedCommandId] = useState("collect");
  const [optionValues, setOptionValues] = useState<Record<string, string | boolean>>({});
  const [dynamicChoices, setDynamicChoices] = useState<Record<string, string[]>>({});
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [genBranch, setGenBranch] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const { showToast } = useToast();
  const logContainerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const logIdRef = useRef(0);
  const logsLenRef = useRef(0);

  const selectedCommand = COMMANDS.find((c) => c.id === selectedCommandId) ?? COMMANDS[0];

  const fetchDynamicChoices = useCallback(() => {
    const urls = new Set<string>();
    for (const cmd of COMMANDS) {
      for (const opt of cmd.options) {
        if (opt.dynamicChoicesUrl) urls.add(opt.dynamicChoicesUrl);
      }
    }
    if (urls.size === 0) return;

    Promise.all(
      [...urls].map(async (url) => {
        try {
          const res = await fetch(url);
          return [url, await res.json()] as [string, string[]];
        } catch {
          return [url, []] as [string, string[]];
        }
      }),
    ).then((results) => {
      const choices: Record<string, string[]> = {};
      for (const [url, data] of results) {
        choices[url] = data;
      }
      setDynamicChoices(choices);
    });
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchDynamicChoices();
    getGenBranch().then((r) => setGenBranch(r.branch));
  }, [fetchDynamicChoices]);

  // Auto-scroll logs (container直接スクロールで親要素への波及を防止)
  useEffect(() => {
    if (logs.length > logsLenRef.current) {
      const el = logContainerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
    logsLenRef.current = logs.length;
  });

  // textarea (memo) 用: ref ベースで管理し、リンク先変更時のみフェッチ
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const lastFetchedRef = useRef<Record<string, string>>({});
  const [memoSaving, setMemoSaving] = useState(false);

  useEffect(() => {
    for (const opt of selectedCommand.options) {
      if (!opt.linkedOptionId || !opt.fetchUrlPattern) continue;
      const linkedValue = (optionValues[opt.linkedOptionId] as string) || "";
      const cacheKey = `${opt.id}:${linkedValue}`;
      if (lastFetchedRef.current[opt.id] === cacheKey) continue;
      lastFetchedRef.current[opt.id] = cacheKey;
      if (!linkedValue) {
        const el = textareaRefs.current[opt.id];
        if (el) el.value = "";
        continue;
      }
      const url = opt.fetchUrlPattern.replace("{value}", linkedValue);
      const optId = opt.id;
      fetch(url)
        .then((res) => res.json())
        .then((data: { content?: string }) => {
          const el = textareaRefs.current[optId];
          if (el) el.value = data.content ?? "";
        })
        .catch(() => {});
    }
  }, [selectedCommand.options, optionValues]);

  const handleSaveMemo = useCallback(
    async (opt: OptionDef) => {
      if (!opt.saveUrlPattern || !opt.linkedOptionId) return;
      const linkedValue = optionValues[opt.linkedOptionId];
      if (typeof linkedValue !== "string" || !linkedValue) return;
      const el = textareaRefs.current[opt.id];
      if (!el) return;
      const url = opt.saveUrlPattern.replace("{value}", linkedValue);
      setMemoSaving(true);
      try {
        await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: el.value }),
        });
      } catch {
        setLogs((prev) => [
          ...prev,
          { id: logIdRef.current++, type: "error", text: "エラー: メモの保存に失敗しました。" },
        ]);
      } finally {
        setMemoSaving(false);
      }
    },
    [optionValues],
  );

  const handleCommandChange = useCallback((cmdId: string) => {
    setSelectedCommandId(cmdId);
    setOptionValues({});
  }, []);

  const setOptionValue = useCallback((optId: string, value: string | boolean) => {
    setOptionValues((prev) => ({ ...prev, [optId]: value }));
  }, []);

  const handleExecute = useCallback(async () => {
    if (running) return;

    // Validate required
    for (const opt of selectedCommand.options) {
      if (opt.required && !optionValues[opt.id]) {
        setLogs((prev) => [
          ...prev,
          {
            id: logIdRef.current++,
            type: "error",
            text: `エラー: 「${opt.label}」は必須です。`,
          },
        ]);
        return;
      }
    }

    setRunning(true);

    // saveUrlPattern を持つオプション（textarea ref）を実行前に保存
    for (const opt of selectedCommand.options) {
      if (!opt.saveUrlPattern || !opt.linkedOptionId) continue;
      const linkedValue = optionValues[opt.linkedOptionId];
      const el = textareaRefs.current[opt.id];
      if (typeof linkedValue === "string" && linkedValue && el) {
        const url = opt.saveUrlPattern.replace("{value}", linkedValue);
        try {
          await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: el.value }),
          });
        } catch {
          setLogs((prev) => [
            ...prev,
            {
              id: logIdRef.current++,
              type: "error",
              text: `エラー: メモの保存に失敗しました。`,
            },
          ]);
          setRunning(false);
          return;
        }
      }
    }

    const args = buildArgs(selectedCommand, optionValues);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await executeCommand(
        selectedCommand.id,
        args,
        (event) => {
          setLogs((prev) => [
            ...prev,
            { id: logIdRef.current++, type: event.type, text: event.data },
          ]);
        },
        controller.signal,
      );
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setLogs((prev) => [
          ...prev,
          {
            id: logIdRef.current++,
            type: "error",
            text: `接続エラー: ${(err as Error).message}`,
          },
        ]);
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
      fetchDynamicChoices();
    }
  }, [running, selectedCommand, optionValues, fetchDynamicChoices]);

  const handleAbort = useCallback(() => {
    abortRef.current?.abort();
    abortCommand().catch(() => {});
  }, []);

  const handleClearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const handleCommitPush = useCallback(async () => {
    if (pushing) return;
    setPushing(true);
    try {
      const result = await commitAndPush();
      showToast({
        title: result.success ? "Commit & Push 完了" : "Commit & Push 失敗",
        output: result.output,
        success: result.success,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      showToast({
        title: "Commit & Push エラー",
        output: message,
        success: false,
      });
    } finally {
      setPushing(false);
    }
  }, [pushing, showToast]);

  const handleSwitchBranch = useCallback(async () => {
    if (switching) return;
    setSwitching(true);
    try {
      const result = await switchGenBranch();
      setGenBranch(result.branch);
      showToast({
        title: result.success ? "ブランチ切替完了" : "ブランチ切替失敗",
        output: result.output,
        success: result.success,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      showToast({
        title: "ブランチ切替エラー",
        output: message,
        success: false,
      });
      // エラー時もブランチ名を再取得
      getGenBranch().then((r) => setGenBranch(r.branch));
    } finally {
      setSwitching(false);
    }
  }, [switching, showToast]);

  if (!isDev) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500 text-sm">
        コマンド実行は開発モードでのみ使用可能です
      </div>
    );
  }

  return (
    <div className={`flex h-full ${isMobile ? "flex-col" : "flex-row"}`}>
      {/* Left Pane */}
      <div
        className={`${
          isMobile ? "h-[45%] border-b" : "w-[380px] shrink-0 border-r"
        } border-gray-800 flex flex-col overflow-hidden`}
      >
        {/* Command selector (固定) */}
        <div className="p-4 pb-0 space-y-3 shrink-0">
          <div className="flex flex-wrap gap-1.5">
            {COMMANDS.map((cmd) => (
              <button
                key={cmd.id}
                type="button"
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedCommandId === cmd.id
                    ? "bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/40"
                    : "bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-gray-300"
                }`}
                onClick={() => handleCommandChange(cmd.id)}
              >
                {cmd.label}
              </button>
            ))}
            <button
              type="button"
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                pushing
                  ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                  : "bg-emerald-600/20 text-emerald-300 ring-1 ring-emerald-500/40 hover:bg-emerald-600/30"
              }`}
              onClick={handleCommitPush}
              disabled={pushing}
            >
              {pushing ? "Push中..." : "Commit & Push"}
            </button>
            <button
              type="button"
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                switching
                  ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                  : "bg-emerald-600/20 text-emerald-300 ring-1 ring-emerald-500/40 hover:bg-emerald-600/30"
              }`}
              onClick={handleSwitchBranch}
              disabled={switching}
            >
              {switching ? "切替中..." : `Branch: ${genBranch ?? "---"}`}
            </button>
          </div>

          {/* Description */}
          <div className="rounded-lg bg-gray-800/30 border border-gray-800 p-3">
            <p className="text-xs text-gray-400 leading-relaxed">{selectedCommand.description}</p>
          </div>
        </div>

        {/* Options (スクロール可能) */}
        <div
          className={`flex-1 overflow-y-auto p-4 ${isMobile ? "" : "pb-32"} space-y-4 dark-scrollbar`}
        >
          {/* Options */}
          {selectedCommand.options.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-600">
                オプション
              </h3>
              {selectedCommand.options.map((opt) => (
                <div key={opt.id}>
                  {opt.type === "checkbox" ? (
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={!!optionValues[opt.id]}
                        onChange={(e) => setOptionValue(opt.id, e.target.checked)}
                        className="rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500/30 focus:ring-offset-0"
                      />
                      <span className="text-xs text-gray-400 group-hover:text-gray-300">
                        {opt.label}
                      </span>
                    </label>
                  ) : opt.type === "select" ? (
                    <label className="block">
                      <span className="block text-xs text-gray-500 mb-1">
                        {opt.label}
                        {opt.required && <span className="text-red-400 ml-0.5">*</span>}
                      </span>
                      <select
                        value={(optionValues[opt.id] as string) || ""}
                        onChange={(e) => setOptionValue(opt.id, e.target.value)}
                        className="w-full px-2 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20"
                      >
                        <option value="">
                          {opt.required ? "選択してください" : "指定なし（デフォルト）"}
                        </option>
                        {(dynamicChoices[opt.dynamicChoicesUrl || ""] || []).map((choice) => (
                          <option key={choice} value={choice}>
                            {choice}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : opt.type === "textarea" ? (
                    <div className="block">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500">{opt.label}</span>
                        {opt.saveUrlPattern && (
                          <button
                            type="button"
                            className="px-2 py-0.5 text-[11px] font-medium rounded bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-gray-200 transition-colors disabled:opacity-50"
                            onClick={() => handleSaveMemo(opt)}
                            disabled={memoSaving}
                          >
                            {memoSaving ? "保存中..." : "保存"}
                          </button>
                        )}
                      </div>
                      <textarea
                        ref={(el) => {
                          textareaRefs.current[opt.id] = el;
                        }}
                        defaultValue=""
                        placeholder={opt.placeholder}
                        rows={opt.rows ?? 6}
                        className="w-full px-2 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 resize-y font-mono"
                      />
                    </div>
                  ) : (
                    <label className="block">
                      <span className="block text-xs text-gray-500 mb-1">{opt.label}</span>
                      <input
                        type="text"
                        value={(optionValues[opt.id] as string) || ""}
                        onChange={(e) => setOptionValue(opt.id, e.target.value)}
                        placeholder={opt.placeholder}
                        className="w-full px-2 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20"
                      />
                    </label>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Execute / Abort (モバイル: スクロール内) */}
          {isMobile && (
            <div className="pt-2 pb-8 flex gap-2">
              {running ? (
                <button
                  type="button"
                  className="flex-1 px-4 py-2 rounded-lg text-xs font-semibold bg-red-500/20 text-red-300 hover:bg-red-500/30 ring-1 ring-red-500/30 transition-colors"
                  onClick={handleAbort}
                >
                  中止
                </button>
              ) : (
                <button
                  type="button"
                  className="flex-1 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 ring-1 ring-indigo-500/30 transition-colors"
                  onClick={handleExecute}
                >
                  実行
                </button>
              )}
              <button
                type="button"
                className="px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
                onClick={handleClearLogs}
                title="ログクリア"
              >
                クリア
              </button>
            </div>
          )}
        </div>

        {/* Execute / Abort (PC: 下部固定) */}
        {!isMobile && (
          <div className="p-4 border-t border-gray-800 flex gap-2">
            {running ? (
              <button
                type="button"
                className="flex-1 px-4 py-2 rounded-lg text-xs font-semibold bg-red-500/20 text-red-300 hover:bg-red-500/30 ring-1 ring-red-500/30 transition-colors"
                onClick={handleAbort}
              >
                中止
              </button>
            ) : (
              <button
                type="button"
                className="flex-1 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 ring-1 ring-indigo-500/30 transition-colors"
                onClick={handleExecute}
              >
                実行
              </button>
            )}
            <button
              type="button"
              className="px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
              onClick={handleClearLogs}
              title="ログクリア"
            >
              クリア
            </button>
          </div>
        )}
      </div>

      {/* Right Pane: Log Output */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-950">
        <div className="px-4 py-2 border-b border-gray-800 flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500">ログ出力</span>
          {running && (
            <span className="flex items-center gap-1.5 text-xs text-indigo-400">
              <span className="size-1.5 rounded-full bg-indigo-400 animate-pulse" />
              実行中...
            </span>
          )}
          <div className="flex-1" />
        </div>
        <div
          ref={logContainerRef}
          className="flex-1 overflow-y-auto p-4 pb-32 font-mono text-xs dark-scrollbar"
        >
          {logs.length === 0 ? (
            <div className="text-gray-600 text-center mt-8">
              コマンドを選択して「実行」を押してください
            </div>
          ) : (
            logs.map((entry) => (
              <div
                key={entry.id}
                className={`whitespace-pre-wrap break-all leading-relaxed ${
                  entry.type === "start"
                    ? "text-blue-400 font-semibold mt-2 first:mt-0"
                    : entry.type === "stderr"
                      ? "text-yellow-400/80"
                      : entry.type === "error"
                        ? "text-red-400"
                        : entry.type === "exit"
                          ? entry.text === "0"
                            ? "text-emerald-400 font-semibold mt-1"
                            : "text-red-400 font-semibold mt-1"
                          : "text-gray-300"
                }`}
              >
                {entry.type === "exit" ? `プロセス終了 (コード: ${entry.text})` : entry.text}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
