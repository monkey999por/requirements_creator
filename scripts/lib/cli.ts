export interface CollectOptions {
  config?: string;
  only?: string;
  dryRun: boolean;
}

export function parseArgs(args: string[]): CollectOptions {
  const opts: CollectOptions = { dryRun: false };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-h" || arg === "--help") {
      console.log("Usage: pnpm collect [options]");
      console.log("");
      console.log("APIからトレンドデータを収集します。");
      console.log("");
      console.log("Options:");
      console.log("  --config <path>  設定ファイルパス（デフォルト: app.config.yaml）");
      console.log("  --only <name>    指定ソースのみ取得");
      console.log("  --dry-run        実際のリクエストを行わず対象を表示");
      console.log("  -h, --help       このヘルプを表示");
      process.exit(0);
    } else if (arg === "--config" && args[i + 1]) {
      opts.config = args[++i];
    } else if (arg === "--only" && args[i + 1]) {
      opts.only = args[++i];
    } else if (arg === "--dry-run") {
      opts.dryRun = true;
    }
  }

  return opts;
}
