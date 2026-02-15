import { useCallback, useEffect, useState } from "react";
import {
  disableScheduler,
  enableScheduler,
  fetchSchedulerStatus,
  type SchedulerSchedule,
  saveSchedule,
} from "../api";

interface SchedulerSettingsProps {
  isMobile: boolean;
  isDev: boolean;
}

const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const DAY_LABELS: Record<string, string> = {
  Mon: "月",
  Tue: "火",
  Wed: "水",
  Thu: "木",
  Fri: "金",
  Sat: "土",
  Sun: "日",
};

export function SchedulerSettings({ isMobile, isDev }: SchedulerSettingsProps) {
  const [timerActive, setTimerActive] = useState(false);
  const [nextRun, setNextRun] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Schedule editing state
  const [days, setDays] = useState<string[]>([...ALL_DAYS]);
  const [times, setTimes] = useState<string[]>(["02:00"]);
  const [newTime, setNewTime] = useState("12:00");

  // Track if schedule has been modified
  const [originalSchedule, setOriginalSchedule] = useState<SchedulerSchedule | null>(null);

  const showMessage = useCallback((type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const status = await fetchSchedulerStatus();
      setTimerActive(status.timerActive);
      setNextRun(status.nextRun);
      setDays(status.schedule.days);
      setTimes(status.schedule.times.length > 0 ? status.schedule.times : ["02:00"]);
      setOriginalSchedule(status.schedule);
    } catch {
      showMessage("error", "ステータスの取得に失敗しました");
    }
  }, [showMessage]);

  useEffect(() => {
    loadStatus().finally(() => setLoading(false));
  }, [loadStatus]);

  const hasChanges =
    originalSchedule &&
    (JSON.stringify([...days].sort()) !== JSON.stringify([...originalSchedule.days].sort()) ||
      JSON.stringify([...times].sort()) !== JSON.stringify([...originalSchedule.times].sort()));

  const handleToggle = async () => {
    setToggling(true);
    setMessage(null);
    try {
      const result = timerActive ? await disableScheduler() : await enableScheduler();
      if (result.success) {
        showMessage(
          "success",
          timerActive ? "スケジューラを無効化しました" : "スケジューラを有効化しました",
        );
      } else {
        showMessage("error", result.output || "操作に失敗しました");
      }
      await loadStatus();
    } catch {
      showMessage("error", "操作に失敗しました");
    } finally {
      setToggling(false);
    }
  };

  const toggleDay = (day: string) => {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const removeTime = (time: string) => {
    setTimes((prev) => prev.filter((t) => t !== time));
  };

  const addTime = () => {
    if (newTime && !times.includes(newTime)) {
      setTimes((prev) => [...prev, newTime].sort());
    }
  };

  const handleSave = async () => {
    if (times.length === 0) {
      showMessage("error", "少なくとも1つの実行時刻が必要です");
      return;
    }
    if (days.length === 0) {
      showMessage("error", "少なくとも1つの曜日を選択してください");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const result = await saveSchedule({ days, times });
      if (result.success) {
        showMessage("success", "スケジュールを保存しました");
        await loadStatus();
      } else {
        showMessage("error", result.error || "保存に失敗しました");
      }
    } catch {
      showMessage("error", "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500 text-sm">
        読み込み中...
      </div>
    );
  }

  return (
    <div
      className={`h-full min-h-0 overflow-y-auto dark-scrollbar ${isMobile ? "px-4 py-4" : "p-8"}`}
    >
      <div className={`max-w-3xl mx-auto space-y-6 ${isMobile ? "pb-24" : ""}`}>
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-gray-100">スケジューラ設定</h1>
          <p className="text-sm text-gray-500 mt-1">パイプラインの自動実行スケジュール</p>
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

        {/* Status + Toggle */}
        <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-4">
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
                次回: <span className="text-gray-300">{nextRun}</span>
              </span>
            )}
          </div>

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

        {/* Schedule Editor */}
        <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-5">
          {/* Days */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-300">実行曜日</h2>
            <div className="flex flex-wrap gap-2">
              {ALL_DAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    days.includes(day)
                      ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                      : "bg-gray-800/50 text-gray-600 border border-gray-700/50 hover:text-gray-400"
                  } ${!isDev ? "cursor-default" : ""}`}
                  onClick={() => isDev && toggleDay(day)}
                  disabled={!isDev}
                >
                  {DAY_LABELS[day]}
                </button>
              ))}
            </div>
          </div>

          {/* Times */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-300">実行時刻</h2>

            {isDev && (
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-blue-500/50"
                />
                <button
                  type="button"
                  className="px-4 py-2.5 rounded-lg text-sm font-medium bg-gray-800 text-gray-400 hover:text-gray-200 border border-gray-700 hover:border-gray-600 transition-colors"
                  onClick={addTime}
                >
                  + 時刻を追加
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {times.map((time) => (
                <div
                  key={time}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-800/50 border border-gray-700/50 rounded-lg text-sm text-gray-300 font-mono"
                >
                  {time}
                  {isDev && (
                    <button
                      type="button"
                      className="p-0.5 rounded text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      onClick={() => removeTime(time)}
                      title="削除"
                    >
                      <svg
                        className="size-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        role="img"
                        aria-label="削除"
                      >
                        <title>削除</title>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Save Button */}
          {isDev && (
            <button
              type="button"
              className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleSave}
              disabled={saving || !hasChanges}
            >
              {saving ? "保存中..." : "保存"}
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
