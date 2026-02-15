import { useCallback, useEffect, useState } from "react";
import {
  disableScheduler,
  enableScheduler,
  fetchSchedulerStatus,
  fetchServiceConfig,
  fetchTimerConfig,
} from "../api";

interface SchedulerSettingsProps {
  isMobile: boolean;
  isDev: boolean;
}

export function SchedulerSettings({ isMobile, isDev }: SchedulerSettingsProps) {
  const [timerActive, setTimerActive] = useState(false);
  const [nextRun, setNextRun] = useState<string | null>(null);
  const [statusOutput, setStatusOutput] = useState("");
  const [timerConfig, setTimerConfig] = useState("");
  const [serviceConfig, setServiceConfig] = useState("");
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [configTab, setConfigTab] = useState<"timer" | "service">("timer");

  const loadStatus = useCallback(async () => {
    try {
      const status = await fetchSchedulerStatus();
      setTimerActive(status.timerActive);
      setNextRun(status.nextRun);
      setStatusOutput(status.output);
    } catch {
      setStatusOutput("ステータスの取得に失敗しました");
    }
  }, []);

  const loadConfigs = useCallback(async () => {
    try {
      const [timer, service] = await Promise.all([fetchTimerConfig(), fetchServiceConfig()]);
      setTimerConfig(timer.content);
      setServiceConfig(service.content);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    Promise.all([loadStatus(), loadConfigs()]).finally(() => setLoading(false));
  }, [loadStatus, loadConfigs]);

  const handleToggle = async () => {
    setToggling(true);
    setMessage(null);
    try {
      const result = timerActive ? await disableScheduler() : await enableScheduler();
      if (result.success) {
        setMessage({
          type: "success",
          text: timerActive ? "スケジューラを無効化しました" : "スケジューラを有効化しました",
        });
      } else {
        setMessage({ type: "error", text: result.output || "操作に失敗しました" });
      }
      await loadStatus();
    } catch {
      setMessage({ type: "error", text: "操作に失敗しました" });
    } finally {
      setToggling(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    await loadStatus();
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500 text-sm">
        読み込み中...
      </div>
    );
  }

  return (
    <div className={`h-full overflow-y-auto dark-scrollbar ${isMobile ? "px-4 py-4" : "p-8"}`}>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-gray-100">スケジューラ設定</h1>
          <p className="text-sm text-gray-500 mt-1">
            パイプラインスケジューラ（systemdタイマー）の管理
          </p>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`px-4 py-3 rounded-lg text-sm ${
              message.type === "success"
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-red-500/10 text-red-400 border border-red-500/20"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Status Card */}
        <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-300">タイマー状態</h2>
            <button
              type="button"
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-700/30 transition-colors"
              onClick={handleRefresh}
              title="更新"
            >
              <svg
                className="size-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182"
                />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                timerActive ? "bg-emerald-500/15 text-emerald-400" : "bg-gray-700/50 text-gray-500"
              }`}
            >
              <span
                className={`size-2 rounded-full ${timerActive ? "bg-emerald-400 animate-pulse" : "bg-gray-600"}`}
              />
              {timerActive ? "有効" : "無効"}
            </span>

            {nextRun && (
              <span className="text-xs text-gray-500">
                次回実行: <span className="text-gray-300">{nextRun}</span>
              </span>
            )}
          </div>

          {/* Toggle Button */}
          {isDev && (
            <button
              type="button"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                timerActive
                  ? "bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/20"
                  : "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20"
              }`}
              onClick={handleToggle}
              disabled={toggling}
            >
              {toggling
                ? "処理中..."
                : timerActive
                  ? "スケジューラを無効化"
                  : "スケジューラを有効化"}
            </button>
          )}

          {!isDev && (
            <p className="text-xs text-gray-600">有効/無効の切り替えはdev modeでのみ利用可能です</p>
          )}
        </section>

        {/* Config Files */}
        <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300">設定ファイル</h2>

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-800/50 p-0.5 rounded-lg w-fit">
            <button
              type="button"
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                configTab === "timer"
                  ? "bg-gray-700 text-gray-200"
                  : "text-gray-500 hover:text-gray-300"
              }`}
              onClick={() => setConfigTab("timer")}
            >
              pipeline.timer
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                configTab === "service"
                  ? "bg-gray-700 text-gray-200"
                  : "text-gray-500 hover:text-gray-300"
              }`}
              onClick={() => setConfigTab("service")}
            >
              pipeline.service
            </button>
          </div>

          <pre className="p-4 bg-gray-950/50 rounded-lg text-xs text-gray-400 overflow-x-auto font-mono leading-relaxed border border-gray-800/50">
            {configTab === "timer" ? timerConfig : serviceConfig}
          </pre>

          <p className="text-[11px] text-gray-600">
            ファイルパス: systemd/pipeline.{configTab === "timer" ? "timer" : "service"}
          </p>
        </section>

        {/* Status Detail */}
        <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-300">詳細ステータス</h2>
          </div>
          <pre className="p-4 bg-gray-950/50 rounded-lg text-xs text-gray-400 overflow-x-auto font-mono leading-relaxed border border-gray-800/50 max-h-80 overflow-y-auto dark-scrollbar whitespace-pre-wrap">
            {statusOutput || "ステータスなし"}
          </pre>
        </section>
      </div>
    </div>
  );
}
