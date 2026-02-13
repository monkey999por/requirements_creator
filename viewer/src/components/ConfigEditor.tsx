import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { type AppConfig, fetchConfig, saveConfig } from "../api";

interface ConfigEditorProps {
  isMobile: boolean;
  isDev: boolean;
}

// 選択肢定義
const COUNTRY_OPTIONS = [
  { value: "us", label: "US (アメリカ)" },
  { value: "jp", label: "JP (日本)" },
  { value: "gb", label: "GB (イギリス)" },
  { value: "de", label: "DE (ドイツ)" },
  { value: "fr", label: "FR (フランス)" },
  { value: "cn", label: "CN (中国)" },
  { value: "kr", label: "KR (韓国)" },
  { value: "in", label: "IN (インド)" },
  { value: "au", label: "AU (オーストラリア)" },
  { value: "ca", label: "CA (カナダ)" },
];

const CATEGORY_OPTIONS = [
  { value: "business", label: "business (ビジネス)" },
  { value: "technology", label: "technology (テクノロジー)" },
  { value: "science", label: "science (科学)" },
  { value: "health", label: "health (健康)" },
  { value: "sports", label: "sports (スポーツ)" },
  { value: "entertainment", label: "entertainment (エンタメ)" },
  { value: "general", label: "general (一般)" },
];

const REGION_CODE_OPTIONS = [
  { value: "JP", label: "JP (日本)" },
  { value: "US", label: "US (アメリカ)" },
  { value: "GB", label: "GB (イギリス)" },
  { value: "DE", label: "DE (ドイツ)" },
  { value: "FR", label: "FR (フランス)" },
  { value: "KR", label: "KR (韓国)" },
  { value: "IN", label: "IN (インド)" },
];

const VIDEO_CATEGORY_OPTIONS = [
  { value: "1", label: "1 - 映画" },
  { value: "10", label: "10 - 音楽" },
  { value: "17", label: "17 - スポーツ" },
  { value: "20", label: "20 - ゲーム" },
  { value: "25", label: "25 - ニュース" },
  { value: "28", label: "28 - 科学技術" },
];

const PLATFORM_OPTIONS = [
  { value: "frontend-only", label: "frontend-only (フロントエンドのみ)" },
  { value: "fullstack", label: "fullstack (フルスタック)" },
  { value: "mobile-android", label: "mobile-android (Android)" },
  { value: "mobile-ios", label: "mobile-ios (iOS)" },
  { value: "mobile-cross", label: "mobile-cross (クロスプラットフォーム)" },
];

const BUDGET_OPTIONS = [
  { value: "free", label: "free (0円)" },
  { value: "low", label: "low (〜5千円/月)" },
  { value: "moderate", label: "moderate (〜5万円/月)" },
  { value: "high", label: "high (上限なし)" },
];

const DIFFICULTY_OPTIONS = [
  { value: "easy", label: "easy (簡単)" },
  { value: "medium", label: "medium (中級)" },
  { value: "hard", label: "hard (上級)" },
];

const TEAM_SIZE_OPTIONS = [
  { value: "solo", label: "solo (1人)" },
  { value: "small", label: "small (2-3人)" },
  { value: "medium", label: "medium (4-8人)" },
  { value: "large", label: "large (9人以上)" },
];

const PERSPECTIVE_MODE_OPTIONS = [
  { value: "single", label: "single (先頭1つのみ)" },
  { value: "combine", label: "combine (複数を掛け合わせ)" },
  { value: "random", label: "random (ランダム選択)" },
];

const PERSPECTIVE_ITEMS = [
  { value: "kindness", label: "kindness", desc: "ユーザーに寄り添う優しいUX設計" },
  { value: "cunning", label: "cunning", desc: "巧妙なマネタイズ・行動設計" },
  { value: "frustration", label: "frustration", desc: "フラストレーション駆動の設計" },
  { value: "dopamine", label: "dopamine", desc: "中毒性のある体験設計" },
  { value: "target-focus", label: "target-focus", desc: "ターゲット層に特化した設計" },
];

const AGENT_ROLE_OPTIONS = [
  { value: "researcher", desc: "トレンド・技術の外部調査" },
  { value: "designer", desc: "アプリコンセプト案を提案" },
  { value: "reviewer", desc: "要件の品質・完全性チェック" },
  { value: "enhancer", desc: "レビュー結果に基づく要件の修正" },
];

const ASSOCIATION_DEPTH_OPTIONS = [
  { value: "shallow", label: "shallow (1段階 - 直接的な関連語・類義語)" },
  { value: "moderate", label: "moderate (2段階 - 関連分野・応用領域まで)" },
  { value: "deep", label: "deep (3段階以上 - 異分野の組み合わせ・創造的な飛躍)" },
];

// --- UI部品 ---

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-bold text-gray-100">{title}</h2>
      <p className="text-xs text-gray-500 mt-0.5">{description}</p>
    </div>
  );
}

function FieldLabel({
  label,
  description,
  htmlFor,
}: {
  label: string;
  description: string;
  htmlFor?: string;
}) {
  return (
    <div className="mb-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-gray-300">
        {label}
      </label>
      <p className="text-[12px] text-gray-500 mt-0.5">{description}</p>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
        checked ? "bg-indigo-500" : "bg-gray-700"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      onClick={() => !disabled && onChange(!checked)}
    >
      <span
        className={`inline-block size-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
          checked ? "translate-x-5.5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function SelectField({
  value,
  options,
  onChange,
  disabled,
  allowEmpty,
  id,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
  allowEmpty?: boolean;
  id?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full px-3 py-1.5 text-sm bg-gray-800 border border-gray-700/50 rounded-lg text-gray-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {allowEmpty && <option value="">未設定</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function NumberField({
  value,
  onChange,
  disabled,
  min,
  max,
  id,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  id?: string;
}) {
  return (
    <input
      id={id}
      type="number"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      disabled={disabled}
      min={min}
      max={max}
      className="w-full px-3 py-1.5 text-sm bg-gray-800 border border-gray-700/50 rounded-lg text-gray-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
    />
  );
}

function TextField({
  value,
  onChange,
  disabled,
  placeholder,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
}) {
  return (
    <input
      id={id}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      className="w-full px-3 py-1.5 text-sm bg-gray-800 border border-gray-700/50 rounded-lg text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
    />
  );
}

function CheckboxGroup({
  options,
  selected,
  onChange,
  disabled,
}: {
  options: { value: string; desc: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
}) {
  const toggle = (val: string) => {
    if (disabled) return;
    onChange(selected.includes(val) ? selected.filter((v) => v !== val) : [...selected, val]);
  };
  return (
    <div className="space-y-1.5">
      {options.map((o) => (
        <label
          key={o.value}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-colors ${
            selected.includes(o.value)
              ? "border-indigo-500/40 bg-indigo-500/10"
              : "border-gray-700/30 bg-gray-800/50"
          } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-gray-800/80"}`}
        >
          <input
            type="checkbox"
            checked={selected.includes(o.value)}
            onChange={() => toggle(o.value)}
            disabled={disabled}
            className="accent-indigo-500"
          />
          <div>
            <span className="text-sm text-gray-200 font-medium">{o.value}</span>
            <span className="text-xs text-gray-500 ml-2">{o.desc}</span>
          </div>
        </label>
      ))}
    </div>
  );
}

// --- メインコンポーネント ---

export function ConfigEditor({ isMobile, isDev }: ConfigEditorProps) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchConfig()
      .then(setConfig)
      .finally(() => setLoading(false));
  }, []);

  const persistConfig = useCallback(
    (updated: AppConfig) => {
      setConfig(updated);
      if (!isDev) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        setSaving(true);
        try {
          await saveConfig(updated);
          setSaveMessage("保存しました");
        } catch {
          setSaveMessage("保存に失敗しました");
        } finally {
          setSaving(false);
          setTimeout(() => setSaveMessage(null), 2000);
        }
      }, 400);
    },
    [isDev],
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500 text-sm">
        読み込み中...
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500 text-sm">
        設定ファイルが見つかりません
      </div>
    );
  }

  const disabled = !isDev;

  // ヘルパー: collect.sources の特定ソースを更新
  const updateSource = (
    sourceName: string,
    updater: (
      src: NonNullable<NonNullable<AppConfig["collect"]>["sources"]>[string],
    ) => NonNullable<NonNullable<AppConfig["collect"]>["sources"]>[string],
  ) => {
    const sources = config.collect?.sources ?? {};
    const src = sources[sourceName] ?? {};
    persistConfig({
      ...config,
      collect: { ...config.collect, sources: { ...sources, [sourceName]: updater(src) } },
    });
  };

  // ヘルパー: generate を更新
  const updateGenerate = (patch: Partial<NonNullable<AppConfig["generate"]>>) => {
    persistConfig({
      ...config,
      generate: { ...config.generate, ...patch },
    });
  };

  // ヘルパー: generate.agents の特定エージェントを更新
  const updateAgent = (
    agentName: string,
    updater: (
      agent: NonNullable<NonNullable<AppConfig["generate"]>["agents"]>[string],
    ) => NonNullable<NonNullable<AppConfig["generate"]>["agents"]>[string],
  ) => {
    const agents = config.generate?.agents ?? {};
    const agent = agents[agentName] ?? {};
    updateGenerate({ agents: { ...agents, [agentName]: updater(agent) } });
  };

  const newsapi = config.collect?.sources?.newsapi;
  const youtube = config.collect?.sources?.youtube;
  const youtubeAll = config.collect?.sources?.youtube_all;
  const constraints = config.generate?.constraints ?? {};
  const perspectives = config.generate?.perspectives;
  const agents = config.generate?.agents ?? {};

  return (
    <div className="h-full overflow-y-auto dark-scrollbar">
      <div className={`${isMobile ? "px-4 py-6" : "px-8 py-8"} max-w-3xl mx-auto space-y-8`}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-100">app.config.yaml</h1>
            <p className="text-xs text-gray-500 mt-1">
              アプリケーション設定の編集
              {!isDev && "（読み取り専用 - dev modeで編集可能）"}
            </p>
          </div>
          <AnimatePresence>
            {(saving || saveMessage) && (
              <motion.span
                className={`text-xs px-3 py-1 rounded-full ${
                  saving
                    ? "bg-gray-800 text-gray-400"
                    : saveMessage?.includes("失敗")
                      ? "bg-red-500/20 text-red-400"
                      : "bg-emerald-500/20 text-emerald-400"
                }`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                {saving ? "保存中..." : saveMessage}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* --- 共通設定 --- */}
        <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <SectionHeader title="共通設定" description="複数フェーズから参照される基本設定" />
          <div>
            <FieldLabel
              label="output_base_dir"
              description="生成データの出力先ベースディレクトリ"
              htmlFor="output_base_dir"
            />
            <TextField
              id="output_base_dir"
              value={config.output_base_dir ?? "gen"}
              onChange={(v) => persistConfig({ ...config, output_base_dir: v })}
              disabled={disabled}
              placeholder="gen"
            />
          </div>
        </section>

        {/* --- Collect フェーズ --- */}
        <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-6">
          <SectionHeader
            title="Collect フェーズ"
            description="外部APIからトレンド情報を収集する設定"
          />

          {/* NewsAPI */}
          <div className="rounded-lg border border-gray-800/50 bg-gray-800/30 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-200">NewsAPI</h3>
                <p className="text-[12px] text-gray-500">ニュースのトップヘッドラインを取得</p>
              </div>
              <Toggle
                checked={newsapi?.enabled ?? false}
                onChange={(v) => updateSource("newsapi", (s) => ({ ...s, enabled: v }))}
                disabled={disabled}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel
                  label="country"
                  description="ニュースの取得対象国"
                  htmlFor="newsapi-country"
                />
                <SelectField
                  id="newsapi-country"
                  value={String(newsapi?.params?.country ?? "us")}
                  options={COUNTRY_OPTIONS}
                  onChange={(v) =>
                    updateSource("newsapi", (s) => ({
                      ...s,
                      params: { ...s.params, country: v },
                    }))
                  }
                  disabled={disabled}
                />
              </div>
              <div>
                <FieldLabel
                  label="category"
                  description="ニュースのカテゴリ"
                  htmlFor="newsapi-category"
                />
                <SelectField
                  id="newsapi-category"
                  value={String(newsapi?.params?.category ?? "business")}
                  options={CATEGORY_OPTIONS}
                  onChange={(v) =>
                    updateSource("newsapi", (s) => ({
                      ...s,
                      params: { ...s.params, category: v },
                    }))
                  }
                  disabled={disabled}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel
                  label="pageSize"
                  description="取得する記事数（最大100）"
                  htmlFor="newsapi-pagesize"
                />
                <NumberField
                  id="newsapi-pagesize"
                  value={Number(newsapi?.params?.pageSize ?? 20)}
                  onChange={(v) =>
                    updateSource("newsapi", (s) => ({
                      ...s,
                      params: { ...s.params, pageSize: v },
                    }))
                  }
                  disabled={disabled}
                  min={1}
                  max={100}
                />
              </div>
              <div>
                <FieldLabel
                  label="output_file"
                  description="出力ファイル名"
                  htmlFor="newsapi-output"
                />
                <TextField
                  id="newsapi-output"
                  value={newsapi?.output_file ?? "news.json"}
                  onChange={(v) => updateSource("newsapi", (s) => ({ ...s, output_file: v }))}
                  disabled={disabled}
                />
              </div>
            </div>
            <div>
              <FieldLabel
                label="api_key_env"
                description="APIキーの環境変数名（.envに定義）"
                htmlFor="newsapi-apikey"
              />
              <TextField
                id="newsapi-apikey"
                value={newsapi?.api_key_env ?? "NEWS_API_KEY"}
                onChange={(v) => updateSource("newsapi", (s) => ({ ...s, api_key_env: v }))}
                disabled={disabled}
              />
            </div>
          </div>

          {/* YouTube（カテゴリ指定） */}
          <div className="rounded-lg border border-gray-800/50 bg-gray-800/30 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-200">
                  YouTube Data API（カテゴリ指定）
                </h3>
                <p className="text-[12px] text-gray-500">指定カテゴリの人気動画ランキングを取得</p>
              </div>
              <Toggle
                checked={youtube?.enabled ?? false}
                onChange={(v) => updateSource("youtube", (s) => ({ ...s, enabled: v }))}
                disabled={disabled}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel
                  label="regionCode"
                  description="動画の取得対象地域"
                  htmlFor="youtube-region"
                />
                <SelectField
                  id="youtube-region"
                  value={String(youtube?.params?.regionCode ?? "JP")}
                  options={REGION_CODE_OPTIONS}
                  onChange={(v) =>
                    updateSource("youtube", (s) => ({
                      ...s,
                      params: { ...s.params, regionCode: v },
                    }))
                  }
                  disabled={disabled}
                />
              </div>
              <div>
                <FieldLabel
                  label="videoCategoryId"
                  description="動画カテゴリ"
                  htmlFor="youtube-category"
                />
                <SelectField
                  id="youtube-category"
                  value={String(youtube?.params?.videoCategoryId ?? "28")}
                  options={VIDEO_CATEGORY_OPTIONS}
                  onChange={(v) =>
                    updateSource("youtube", (s) => ({
                      ...s,
                      params: { ...s.params, videoCategoryId: v },
                    }))
                  }
                  disabled={disabled}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel
                  label="maxResults"
                  description="取得する動画数（最大50）"
                  htmlFor="youtube-maxresults"
                />
                <NumberField
                  id="youtube-maxresults"
                  value={Number(youtube?.params?.maxResults ?? 20)}
                  onChange={(v) =>
                    updateSource("youtube", (s) => ({
                      ...s,
                      params: { ...s.params, maxResults: v },
                    }))
                  }
                  disabled={disabled}
                  min={1}
                  max={50}
                />
              </div>
              <div>
                <FieldLabel
                  label="output_file"
                  description="出力ファイル名"
                  htmlFor="youtube-output"
                />
                <TextField
                  id="youtube-output"
                  value={youtube?.output_file ?? "youtube.json"}
                  onChange={(v) => updateSource("youtube", (s) => ({ ...s, output_file: v }))}
                  disabled={disabled}
                />
              </div>
            </div>
            <div>
              <FieldLabel
                label="api_key_env"
                description="APIキーの環境変数名（.envに定義）"
                htmlFor="youtube-apikey"
              />
              <TextField
                id="youtube-apikey"
                value={youtube?.api_key_env ?? "YOUTUBE_DATA_API_KEY"}
                onChange={(v) => updateSource("youtube", (s) => ({ ...s, api_key_env: v }))}
                disabled={disabled}
              />
            </div>
          </div>

          {/* YouTube（全体） */}
          <div className="rounded-lg border border-gray-800/50 bg-gray-800/30 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-200">YouTube Data API（全体）</h3>
                <p className="text-[12px] text-gray-500">
                  カテゴリ指定なしの全体人気動画ランキングを取得
                </p>
              </div>
              <Toggle
                checked={youtubeAll?.enabled ?? false}
                onChange={(v) => updateSource("youtube_all", (s) => ({ ...s, enabled: v }))}
                disabled={disabled}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel
                  label="regionCode"
                  description="動画の取得対象地域"
                  htmlFor="youtube-all-region"
                />
                <SelectField
                  id="youtube-all-region"
                  value={String(youtubeAll?.params?.regionCode ?? "JP")}
                  options={REGION_CODE_OPTIONS}
                  onChange={(v) =>
                    updateSource("youtube_all", (s) => ({
                      ...s,
                      params: { ...s.params, regionCode: v },
                    }))
                  }
                  disabled={disabled}
                />
              </div>
              <div>
                <FieldLabel
                  label="maxResults"
                  description="取得する動画数（最大50）"
                  htmlFor="youtube-all-maxresults"
                />
                <NumberField
                  id="youtube-all-maxresults"
                  value={Number(youtubeAll?.params?.maxResults ?? 20)}
                  onChange={(v) =>
                    updateSource("youtube_all", (s) => ({
                      ...s,
                      params: { ...s.params, maxResults: v },
                    }))
                  }
                  disabled={disabled}
                  min={1}
                  max={50}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel
                  label="output_file"
                  description="出力ファイル名"
                  htmlFor="youtube-all-output"
                />
                <TextField
                  id="youtube-all-output"
                  value={youtubeAll?.output_file ?? "youtube_all.json"}
                  onChange={(v) => updateSource("youtube_all", (s) => ({ ...s, output_file: v }))}
                  disabled={disabled}
                />
              </div>
              <div>
                <FieldLabel
                  label="api_key_env"
                  description="APIキーの環境変数名（.envに定義）"
                  htmlFor="youtube-all-apikey"
                />
                <TextField
                  id="youtube-all-apikey"
                  value={youtubeAll?.api_key_env ?? "YOUTUBE_DATA_API_KEY"}
                  onChange={(v) => updateSource("youtube_all", (s) => ({ ...s, api_key_env: v }))}
                  disabled={disabled}
                />
              </div>
            </div>
          </div>
        </section>

        {/* --- Extract フェーズ --- */}
        <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-6">
          <SectionHeader
            title="Extract フェーズ"
            description="収集データからキーワードを抽出する際の設定"
          />

          <div className="rounded-lg border border-gray-800/50 bg-gray-800/30 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-200">連想ゲーム方式</h3>
                <p className="text-[12px] text-gray-500">
                  収集データに直接記載されていない関連キーワードも連想で抽出
                </p>
              </div>
              <Toggle
                checked={config.extract?.association?.enabled ?? true}
                onChange={(v) =>
                  persistConfig({
                    ...config,
                    extract: {
                      ...config.extract,
                      association: { ...config.extract?.association, enabled: v },
                    },
                  })
                }
                disabled={disabled}
              />
            </div>
            <div>
              <FieldLabel
                label="depth"
                description="連想キーワード生成の段階数"
                htmlFor="extract-depth"
              />
              <SelectField
                id="extract-depth"
                value={config.extract?.association?.depth ?? "moderate"}
                options={ASSOCIATION_DEPTH_OPTIONS}
                onChange={(v) =>
                  persistConfig({
                    ...config,
                    extract: {
                      ...config.extract,
                      association: { ...config.extract?.association, depth: v },
                    },
                  })
                }
                disabled={disabled}
              />
            </div>
          </div>
        </section>

        {/* --- Generate フェーズ --- */}
        <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-6">
          <SectionHeader
            title="Generate フェーズ"
            description="キーワードからアプリ案を生成する際の制約・観点を設定"
          />

          {/* Constraints */}
          <div className="rounded-lg border border-gray-800/50 bg-gray-800/30 p-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-200">制約条件 (constraints)</h3>
            <p className="text-[12px] text-gray-500">
              生成されるアプリ案の技術構成・規模を制御。未設定の項目はAIが自由に判断
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel
                  label="platform"
                  description="対象プラットフォーム"
                  htmlFor="constraints-platform"
                />
                <SelectField
                  id="constraints-platform"
                  value={constraints.platform ?? ""}
                  options={PLATFORM_OPTIONS}
                  onChange={(v) =>
                    updateGenerate({
                      constraints: v
                        ? { ...constraints, platform: v }
                        : (() => {
                            const { platform: _, ...rest } = constraints;
                            return rest;
                          })(),
                    })
                  }
                  disabled={disabled}
                  allowEmpty
                />
              </div>
              <div>
                <FieldLabel
                  label="budget"
                  description="月額予算の目安"
                  htmlFor="constraints-budget"
                />
                <SelectField
                  id="constraints-budget"
                  value={constraints.budget ?? ""}
                  options={BUDGET_OPTIONS}
                  onChange={(v) =>
                    updateGenerate({
                      constraints: v
                        ? { ...constraints, budget: v }
                        : (() => {
                            const { budget: _, ...rest } = constraints;
                            return rest;
                          })(),
                    })
                  }
                  disabled={disabled}
                  allowEmpty
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel
                  label="difficulty"
                  description="開発難易度"
                  htmlFor="constraints-difficulty"
                />
                <SelectField
                  id="constraints-difficulty"
                  value={constraints.difficulty ?? ""}
                  options={DIFFICULTY_OPTIONS}
                  onChange={(v) =>
                    updateGenerate({
                      constraints: v
                        ? { ...constraints, difficulty: v }
                        : (() => {
                            const { difficulty: _, ...rest } = constraints;
                            return rest;
                          })(),
                    })
                  }
                  disabled={disabled}
                  allowEmpty
                />
              </div>
              <div>
                <FieldLabel
                  label="team_size"
                  description="チーム規模"
                  htmlFor="constraints-teamsize"
                />
                <SelectField
                  id="constraints-teamsize"
                  value={constraints.team_size ?? ""}
                  options={TEAM_SIZE_OPTIONS}
                  onChange={(v) =>
                    updateGenerate({
                      constraints: v
                        ? { ...constraints, team_size: v }
                        : (() => {
                            const { team_size: _, ...rest } = constraints;
                            return rest;
                          })(),
                    })
                  }
                  disabled={disabled}
                  allowEmpty
                />
              </div>
            </div>
          </div>

          {/* Perspectives */}
          <div className="rounded-lg border border-gray-800/50 bg-gray-800/30 p-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-200">生成観点 (perspectives)</h3>
            <p className="text-[12px] text-gray-500">
              アプリ案の体験設計・マネタイズ戦略の方向性を指定
            </p>
            <div>
              <FieldLabel label="mode" description="観点の適用モード" htmlFor="perspectives-mode" />
              <SelectField
                id="perspectives-mode"
                value={perspectives?.mode ?? ""}
                options={PERSPECTIVE_MODE_OPTIONS}
                onChange={(v) =>
                  updateGenerate({
                    perspectives: v ? { ...perspectives, mode: v } : undefined,
                  })
                }
                disabled={disabled}
                allowEmpty
              />
            </div>
            {perspectives?.mode && perspectives.mode !== "random" && (
              <div>
                <FieldLabel label="items" description="適用する観点を選択" />
                <CheckboxGroup
                  options={PERSPECTIVE_ITEMS}
                  selected={perspectives?.items ?? []}
                  onChange={(items) => updateGenerate({ perspectives: { ...perspectives, items } })}
                  disabled={disabled}
                />
              </div>
            )}
            {perspectives?.mode === "random" && (
              <p className="text-xs text-gray-500 italic px-1">
                random モードではランダムに1〜3個の観点が自動選択されます（items は無視）
              </p>
            )}
          </div>

          {/* Agents */}
          <div className="rounded-lg border border-gray-800/50 bg-gray-800/30 p-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-200">マルチエージェント (agents)</h3>
            <p className="text-[12px] text-gray-500">
              要件生成の各フェーズで活用するエージェントの設定
            </p>

            {Object.entries(agents).map(([name, agent]) => (
              <div
                key={name}
                className="rounded-lg border border-gray-700/30 bg-gray-900/50 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-200 capitalize">{name}</h4>
                    {agent.model && (
                      <span className="text-[12px] text-gray-500">model: {agent.model}</span>
                    )}
                  </div>
                  <Toggle
                    checked={agent.enabled ?? false}
                    onChange={(v) => updateAgent(name, (a) => ({ ...a, enabled: v }))}
                    disabled={disabled}
                  />
                </div>
                <div>
                  <FieldLabel
                    label="model"
                    description="使用するモデル名"
                    htmlFor={`agent-${name}-model`}
                  />
                  <TextField
                    id={`agent-${name}-model`}
                    value={agent.model ?? ""}
                    onChange={(v) => updateAgent(name, (a) => ({ ...a, model: v }))}
                    disabled={disabled}
                    placeholder="例: o4-mini, gemini-2.5-pro"
                  />
                </div>
                <div>
                  <FieldLabel label="roles" description="割り当てる役割" />
                  <CheckboxGroup
                    options={AGENT_ROLE_OPTIONS}
                    selected={agent.roles ?? []}
                    onChange={(roles) => updateAgent(name, (a) => ({ ...a, roles }))}
                    disabled={disabled}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* --- Pipeline --- */}
        <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <SectionHeader title="Pipeline" description="パイプライン共通の設定" />
          <div>
            <FieldLabel
              label="default_source"
              description="デフォルトのdata_sourceディレクトリ名（空欄で最新を自動検出）"
              htmlFor="pipeline-source"
            />
            <TextField
              id="pipeline-source"
              value={config.pipeline?.default_source ?? ""}
              onChange={(v) =>
                persistConfig({
                  ...config,
                  pipeline: v ? { ...config.pipeline, default_source: v } : undefined,
                })
              }
              disabled={disabled}
              placeholder="例: 2026_02_10_01_54_10（空欄で自動検出）"
            />
          </div>
        </section>

        {/* spacer */}
        <div className="h-32" />
      </div>
    </div>
  );
}
