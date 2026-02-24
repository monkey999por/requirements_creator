# DevContainer

## 開発方針

本プロジェクトは**コンテナ内での開発を基本方針**とする。ホストマシンにはDockerとエディタ（VS Code等）のみを要求し、Node.js、pnpm、Claude Code等の開発ツールはすべてコンテナ内に閉じる。

これにより:
- 開発環境の差異をなくし、誰でも同じ環境で作業できる
- ホストマシンの汚染を防ぐ（グローバルインストール不要）
- `devcontainer up` 一発で開発環境が整う

## Prerequisites

- Docker Desktop または Docker Engine

## 起動

### A. devcontainer CLI（推奨）

```zsh
npm install -g @devcontainers/cli  # 初回のみ
devcontainer up
```

### B. VS Code

1. VS Code拡張機能「Dev Containers」をインストール
2. VS Codeでプロジェクトを開く
3. `Cmd/Ctrl + Shift + P` → 「Dev Containers: Reopen in Container」を選択

どちらの方法でも devcontainer が起動する（`compose.yaml` で定義）。

## コマンド実行

```zsh
# コンテナ内でコマンド実行
devcontainer exec <command>

# シェルに入る
devcontainer exec /bin/zsh

# コンテナ停止
docker compose stop
```

> **注意**: `down` ではなく `stop` を使うこと。`down` はコンテナを削除するため、Claude Codeのセッションや GitHub CLI の認証など、コンテナ内の状態が失われる。`stop` はコンテナを停止するだけなので、再起動時に状態が維持される。

## コンテナ構成

単一のDockerコンテナ内にすべてのコンポーネントが同居する。

```
┌─────────────────────────────────────┐
│            devcontainer             │
│                                     │
│  supervisord (PID 1)                │
│    └── viewer (port 3001)           │
│         └── croner スケジューラ内蔵  │
│                                     │
│  Claude Code CLI                    │
│  git, gh, zsh, jq, tmux, etc.      │
│                                     │
│  Volumes:                           │
│    /workspace        (bind mount)   │
│    /home/node/.ssh   (bind mount,ro)│
│                                     │
│  User: node (sudo可)                │
│  Shell: zsh (powerlevel10k)         │
└─────────────────────────────────────┘
```

### なぜ同一コンテナか

ViewerとClaude Codeを別コンテナにすると、パイプライン実行やファイルアクセスが困難になる。同一コンテナ内でsupervisordを使ってViewerを常駐させることで:
- Viewerからパイプラインコマンドを直接実行できる
- croner内蔵スケジューラがViewerプロセス内で常時動作する
- ボリュームマウントやネットワーク設定が単純になる

### Dockerfile

ベースイメージは `node:22`。主なインストール内容:

| カテゴリ | パッケージ |
|---------|-----------|
| 開発ツール | git, gh, zsh, fzf, jq, tmux, nano, vim |
| ネットワーク | iptables, ipset, iproute2, dnsutils, openssh-client |
| プロセス管理 | supervisor |
| グローバルnpm | `@anthropic-ai/claude-code`, `pnpm` |
| その他 | git-delta, zsh-in-docker (powerlevel10k) |

ビルド引数（`compose.yaml` で指定）:

| ARG | デフォルト | 用途 |
|-----|-----------|------|
| `TZ` | `Asia/Tokyo` | タイムゾーン |
| `CLAUDE_CODE_VERSION` | `latest` | Claude Codeバージョン |
| `GIT_DELTA_VERSION` | `0.18.2` | git-deltaバージョン |
| `ZSH_IN_DOCKER_VERSION` | `1.2.0` | zsh-in-dockerバージョン |
| `PNPM_VERSION` | `10.28.0` | pnpmバージョン |

### ボリューム

| マウント | 種類 | 用途 |
|---------|------|------|
| `.:/workspace:cached` | bind | プロジェクトファイル（ホストと共有） |
| `~/.ssh:/home/node/.ssh:ro` | bind (読み取り専用) | SSH鍵（Git操作用） |

### supervisord

Viewerをバックグラウンドで常駐させる。コンテナ起動時に `supervisord` がPID 1として動き、Viewerプロセスを管理する。

- 設定ファイル: `.devcontainer/supervisord.conf`
- Viewerのログ: `logs/viewer-stdout.log`, `logs/viewer-stderr.log`
- supervisord自体のログ: `/tmp/supervisord.log`（コンテナ内のみ）

Viewerが常時起動しているため、croner内蔵スケジューラも自動的に動作する。スケジュール設定はプロジェクトルートの `.scheduler-state.json` に永続化される。

### コンテナ環境変数

`devcontainer.json` の `containerEnv` で定義:

| 変数 | 値 | 用途 |
|------|-----|------|
| `NODE_OPTIONS` | `--max-old-space-size=4096` | Node.jsメモリ上限 |
| `CLAUDE_CONFIG_DIR` | `/home/node/.claude` | Claude設定ディレクトリ |
| `POWERLEVEL9K_DISABLE_GITSTATUS` | `true` | プロンプト高速化 |
| `UMASK` | `0022` | ファイルパーミッション |

Dockerfile内で `DEVCONTAINER=true` が設定されている。

### ポートフォワード

| ポート | サービス | 用途 |
|--------|---------|------|
| `3001` | Viewer | Webビューワー（`VIEWER_HOST_PORT` 環境変数で変更可能） |

### SSH & Dotfiles

- ホストの `~/.ssh` を読み取り専用でマウントするため、SSH鍵の設定なしでGit操作が可能
- 初回コンテナ作成時に `setup-dotfiles.sh` がdotfilesリポジトリをクローンしインストーラーを実行する（`DOTFILES_REPO` 環境変数で変更可能）
- 冪等性あり（インストール済みの場合はスキップ）

### ファイアウォール（オプション）

`init-firewall.sh` でコンテナからのネットワークアクセスを制限できる。許可リスト方式で以下のみ通信を許可:

- GitHub（API, Web, Git）
- npmレジストリ
- Anthropic API
- VS Code Marketplace
- DNS, SSH, localhost

## ファイル構成

| ファイル | 役割 |
|---------|------|
| `compose.yaml` | サービス定義（devcontainer 1サービス）、ボリューム、環境変数 |
| `.devcontainer/Dockerfile` | コンテナイメージ定義 |
| `.devcontainer/devcontainer.json` | compose統合、ポートフォワード、VS Code拡張機能、ライフサイクルフック |
| `.devcontainer/supervisord.conf` | Viewerプロセス管理 |
| `.devcontainer/setup-dotfiles.sh` | dotfilesインストーラー（postCreateCommand） |
| `.devcontainer/init-firewall.sh` | ネットワーク制限（オプション） |
