/**
 * エラーオブジェクトからメッセージ文字列を取得する共通ユーティリティ
 */
export function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
