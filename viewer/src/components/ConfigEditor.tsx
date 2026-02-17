import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { type AppConfig, fetchConfig, saveConfig } from "../api";
import {
  CheckboxGroup,
  FieldLabel,
  NumberField,
  SectionHeader,
  SelectField,
  SourceCard,
  TextField,
  Toggle,
} from "./shared/FormControls";

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

const WOEID_OPTIONS = [
  { value: "1", label: "1 - 世界" },
  { value: "23424856", label: "23424856 - 日本" },
  { value: "1118370", label: "1118370 - 東京" },
  { value: "23424977", label: "23424977 - アメリカ" },
  { value: "23424975", label: "23424975 - イギリス" },
  { value: "23424868", label: "23424868 - 韓国" },
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

const THREADS_SEARCH_TYPE_OPTIONS = [
  { value: "TOP", label: "TOP (人気順)" },
  { value: "RECENT", label: "RECENT (新着順)" },
];

const THREADS_SEARCH_MODE_OPTIONS = [
  { value: "KEYWORD", label: "KEYWORD (キーワード検索)" },
  { value: "TAG", label: "TAG (トピックタグ検索)" },
];

const THREADS_MEDIA_TYPE_OPTIONS = [
  { value: "TEXT", label: "TEXT (テキスト)" },
  { value: "IMAGE", label: "IMAGE (画像)" },
  { value: "VIDEO", label: "VIDEO (動画)" },
];

const ASSOCIATION_DEPTH_OPTIONS = [
  { value: "shallow", label: "shallow (1段階 - 直接的な関連語・類義語)" },
  { value: "moderate", label: "moderate (2段階 - 関連分野・応用領域まで)" },
  { value: "deep", label: "deep (3段階以上 - 異分野の組み合わせ・創造的な飛躍)" },
];

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
  const xTrends = config.collect?.sources?.x;
  const xPopularPosts = config.collect?.sources?.x_popular_posts;
  const threads = config.collect?.sources?.threads;
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

        {/* --- Collect フェーズ --- */}
        <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-6">
          <SectionHeader
            title="Collect フェーズ"
            description="外部APIからトレンド情報を収集する設定"
          />

          {/* NewsAPI */}
          <SourceCard
            title="NewsAPI"
            description="ニュースのトップヘッドラインを取得"
            enabled={newsapi?.enabled ?? false}
            onToggle={(v) => updateSource("newsapi", (s) => ({ ...s, enabled: v }))}
            disabled={disabled}
          >
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
          </SourceCard>

          {/* YouTube（カテゴリ指定） */}
          <SourceCard
            title="YouTube Data API（カテゴリ指定）"
            description="指定カテゴリの人気動画ランキングを取得"
            enabled={youtube?.enabled ?? false}
            onToggle={(v) => updateSource("youtube", (s) => ({ ...s, enabled: v }))}
            disabled={disabled}
          >
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
          </SourceCard>

          {/* YouTube（全体） */}
          <SourceCard
            title="YouTube Data API（全体）"
            description="カテゴリ指定なしの全体人気動画ランキングを取得"
            enabled={youtubeAll?.enabled ?? false}
            onToggle={(v) => updateSource("youtube_all", (s) => ({ ...s, enabled: v }))}
            disabled={disabled}
          >
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
          </SourceCard>

          {/* X (Twitter) Trends */}
          <SourceCard
            title="X (Twitter) Trends API"
            description="地域別のトレンドトピックを取得"
            enabled={xTrends?.enabled ?? false}
            onToggle={(v) => updateSource("x", (s) => ({ ...s, enabled: v }))}
            disabled={disabled}
          >
            <div>
              <FieldLabel label="woeid" description="地域コード (WOEID)" htmlFor="x-woeid" />
              <SelectField
                id="x-woeid"
                value={String(xTrends?.params?.woeid ?? "23424856")}
                options={WOEID_OPTIONS}
                onChange={(v) =>
                  updateSource("x", (s) => ({
                    ...s,
                    params: { ...s.params, woeid: Number(v) },
                  }))
                }
                disabled={disabled}
              />
            </div>
          </SourceCard>

          {/* X (Twitter) Popular Posts */}
          <SourceCard
            title="X (Twitter) Popular Posts"
            description="バズったツイートをrelevancy順で取得"
            enabled={xPopularPosts?.enabled ?? false}
            onToggle={(v) => updateSource("x_popular_posts", (s) => ({ ...s, enabled: v }))}
            disabled={disabled}
          >
            <div>
              <FieldLabel
                label="query"
                description="検索クエリ（キーワードが最低1つ必要。例: #AI lang:ja -is:retweet）"
                htmlFor="xpp-query"
              />
              <TextField
                id="xpp-query"
                value={String(
                  xPopularPosts?.params?.query ??
                    "(話題 OR トレンド OR 注目 OR ニュース OR 最新) lang:ja -is:retweet -is:reply",
                )}
                onChange={(v) =>
                  updateSource("x_popular_posts", (s) => ({
                    ...s,
                    params: { ...s.params, query: v },
                  }))
                }
                disabled={disabled}
                placeholder="(話題 OR トレンド) lang:ja -is:retweet -is:reply"
              />
            </div>
            <div>
              <FieldLabel
                label="maxResults"
                description="取得するツイート数（10〜100）"
                htmlFor="xpp-maxresults"
              />
              <NumberField
                id="xpp-maxresults"
                value={Number(xPopularPosts?.params?.maxResults ?? 20)}
                onChange={(v) =>
                  updateSource("x_popular_posts", (s) => ({
                    ...s,
                    params: { ...s.params, maxResults: v },
                  }))
                }
                disabled={disabled}
                min={10}
                max={100}
              />
            </div>
          </SourceCard>

          {/* Threads */}
          <SourceCard
            title="Threads API"
            description="キーワード検索でThreadsの投稿を取得"
            enabled={threads?.enabled ?? false}
            onToggle={(v) => updateSource("threads", (s) => ({ ...s, enabled: v }))}
            disabled={disabled}
          >
            <div>
              <FieldLabel label="q" description="検索キーワード" htmlFor="threads-query" />
              <TextField
                id="threads-query"
                value={String(threads?.params?.q ?? "トレンド")}
                onChange={(v) =>
                  updateSource("threads", (s) => ({
                    ...s,
                    params: { ...s.params, q: v },
                  }))
                }
                disabled={disabled}
                placeholder="トレンド"
              />
            </div>
            <div>
              <FieldLabel
                label="search_type"
                description="検索結果のソート順"
                htmlFor="threads-search-type"
              />
              <SelectField
                id="threads-search-type"
                value={String(threads?.params?.search_type ?? "TOP")}
                options={THREADS_SEARCH_TYPE_OPTIONS}
                onChange={(v) =>
                  updateSource("threads", (s) => ({
                    ...s,
                    params: { ...s.params, search_type: v },
                  }))
                }
                disabled={disabled}
              />
            </div>
            <div>
              <FieldLabel
                label="search_mode"
                description="検索モード（KEYWORD: キーワード / TAG: トピックタグ）"
                htmlFor="threads-search-mode"
              />
              <SelectField
                id="threads-search-mode"
                value={String(threads?.params?.search_mode ?? "KEYWORD")}
                options={THREADS_SEARCH_MODE_OPTIONS}
                onChange={(v) =>
                  updateSource("threads", (s) => ({
                    ...s,
                    params: { ...s.params, search_mode: v },
                  }))
                }
                disabled={disabled}
              />
            </div>
            <div>
              <FieldLabel
                label="media_type"
                description="メディアタイプで絞り込み（空欄で全タイプ）"
                htmlFor="threads-media-type"
              />
              <SelectField
                id="threads-media-type"
                value={String(threads?.params?.media_type ?? "")}
                options={THREADS_MEDIA_TYPE_OPTIONS}
                onChange={(v) =>
                  updateSource("threads", (s) => ({
                    ...s,
                    params: { ...s.params, media_type: v || undefined },
                  }))
                }
                disabled={disabled}
                allowEmpty
              />
            </div>
            <div>
              <FieldLabel
                label="limit"
                description="取得件数（最大100、デフォルト25）"
                htmlFor="threads-limit"
              />
              <NumberField
                id="threads-limit"
                value={Number(threads?.params?.limit ?? 25)}
                onChange={(v) =>
                  updateSource("threads", (s) => ({
                    ...s,
                    params: { ...s.params, limit: v },
                  }))
                }
                disabled={disabled}
                min={1}
                max={100}
              />
            </div>
          </SourceCard>
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

        {/* --- Notifications --- */}
        <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-4">
          <SectionHeader title="Notifications" description="パイプライン完了時の通知設定" />

          {/* Slack */}
          <div className="rounded-lg border border-gray-800/50 bg-gray-800/30 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-200">Slack</h3>
                <p className="text-[12px] text-gray-500">
                  パイプライン完了時にSlackチャンネルへ通知
                </p>
              </div>
              <Toggle
                checked={config.notifications?.slack?.enabled ?? false}
                onChange={(v) =>
                  persistConfig({
                    ...config,
                    notifications: {
                      ...config.notifications,
                      slack: { ...config.notifications?.slack, enabled: v },
                    },
                  })
                }
                disabled={disabled}
              />
            </div>
            <div>
              <FieldLabel
                label="viewer_host"
                description="通知メッセージ内のアプリリンクに使用するViewerホストURL"
                htmlFor="slack-viewer-host"
              />
              <TextField
                id="slack-viewer-host"
                value={config.notifications?.slack?.viewer_host ?? ""}
                onChange={(v) =>
                  persistConfig({
                    ...config,
                    notifications: {
                      ...config.notifications,
                      slack: { ...config.notifications?.slack, viewer_host: v || undefined },
                    },
                  })
                }
                disabled={disabled}
                placeholder="例: http://100.113.125.78:3001"
              />
            </div>
            <div>
              <FieldLabel
                label="mention"
                description="通知時のメンション（Slack User ID または 'channel'。空欄でメンションなし）"
                htmlFor="slack-mention"
              />
              <TextField
                id="slack-mention"
                value={config.notifications?.slack?.mention ?? ""}
                onChange={(v) =>
                  persistConfig({
                    ...config,
                    notifications: {
                      ...config.notifications,
                      slack: { ...config.notifications?.slack, mention: v || undefined },
                    },
                  })
                }
                disabled={disabled}
                placeholder="例: U01ABCDEF または channel"
              />
            </div>
          </div>
        </section>

        {/* spacer */}
        <div className="h-32" />
      </div>
    </div>
  );
}
