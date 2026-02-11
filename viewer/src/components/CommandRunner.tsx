import { useCallback, useEffect, useRef, useState } from "react";
import { abortCommand, type CommandEvent, executeCommand } from "../api";

// --- Types ---

interface LogEntry {
  id: number;
  type: CommandEvent["type"];
  text: string;
}

interface OptionDef {
  id: string;
  label: string;
  type: "select" | "checkbox" | "text";
  dynamicChoicesUrl?: string;
  argFlag?: string;
  positional?: boolean;
  placeholder?: string;
  required?: boolean;
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
        id: "datasetSource",
        label: "データセットソースファイル（データセットモード）",
        type: "text",
        argFlag: "--dataset-source",
        placeholder: "gen/datasets/my_dataset_source.md",
      },
      {
        id: "datasetName",
        label: "データセット名（データセットモード）",
        type: "text",
        argFlag: "--dataset-name",
        placeholder: "my_dataset",
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
        label: "メモ",
        type: "text",
        argFlag: "--memo",
        placeholder: "改善指示を入力...",
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
    const val = values[opt.id];
    if (opt.type === "checkbox" && val === true && opt.argFlag) {
      flags.push(opt.argFlag);
    } else if ((opt.type === "select" || opt.type === "text") && typeof val === "string" && val) {
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
  const logEndRef = useRef<HTMLDivElement>(null);
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
  }, [fetchDynamicChoices]);

  // Auto-scroll logs
  useEffect(() => {
    if (logs.length > logsLenRef.current) {
      logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    logsLenRef.current = logs.length;
  });

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
        <div className="flex-1 overflow-y-auto p-4 space-y-4 dark-scrollbar">
          {/* Command selector */}
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
          </div>

          {/* Description */}
          <div className="rounded-lg bg-gray-800/30 border border-gray-800 p-3">
            <p className="text-xs text-gray-400 leading-relaxed">{selectedCommand.description}</p>
          </div>

          {/* Options */}
          {selectedCommand.options.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-600">
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
        </div>

        {/* Execute / Abort */}
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
      </div>

      {/* Right Pane: Log Output */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-950">
        <div className="px-4 py-2 border-b border-gray-800 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500">ログ出力</span>
          {running && (
            <span className="flex items-center gap-1.5 text-xs text-indigo-400">
              <span className="size-1.5 rounded-full bg-indigo-400 animate-pulse" />
              実行中...
            </span>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs dark-scrollbar">
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
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}
