# vmux — VS Code 向けエージェントフレンドリーなターミナル拡張

[English](README.md) | [Korean](README.ko.md) | [日本語](README.ja.md)

Claude Code、Codex、Gemini CLI などの AI コーディングエージェント向けの VS Code ターミナル拡張です。
エージェントがターミナルから通知を送信し、セッションを管理し、自分の実行コンテキストを把握できるようにします。

> macOS 向けネイティブエージェントターミナルである [cmux](https://github.com/manaflow-ai/cmux) に着想を得ています。

## 主な機能

### Phase 1: Core（実装済み）
- **エージェント通知システム** — エージェントがユーザーの注意を必要とするときに通知を送信（Status Bar バッジ + Tree View + システム通知）
- **ターミナルセッション管理** — split グループを含む名前付きターミナルセッションの作成、保存、復元
- **環境コンテキスト注入** — `VMUX_*` 環境変数を自動注入
- **IPC サーバー** — Unix socket（macOS/Linux）上の JSON-RPC 2.0、Windows では HTTP fallback
- **CLI ツール** — `vmux` コマンドで拡張機能を外部から制御

### Phase 2: Metadata & Monitoring（実装済み）
- **サイドバーのメタデータパネル** — ターミナルごとの status pill、progress bar、構造化ログ（`vmux set-status`、`set-progress`、`log`）
- **ターミナルアクティビティモニター** — Shell Integration API により active/idle 状態、最後のコマンド時刻、CWD、終了コードを追跡

### Phase 3: Programmable Control（実装済み）
- **マルチエージェントオーケストレーション** — エージェントグリッドレイアウト（`vmux launch-grid`）、コマンドのブロードキャスト（`vmux broadcast`）、起動テンプレート
- **MCP サーバー統合** — ターミナル、通知、セッション、メタデータ、グリッドを制御するための 17 個の MCP ツール

## アーキテクチャ

![Architecture Overview](docs/images/architecture.png)

> 元の draw.io ファイル: [`docs/diagrams/architecture.drawio`](docs/diagrams/architecture.drawio)

## クイックスタート

### 1. インストール

```bash
# 開発モード: VS Code で F5 を押して Extension Development Host を起動
# または VSIX を直接インストール
code --install-extension vmux-0.1.0.vsix
```

### 2. CLI の使用

VS Code ターミナル内で、拡張機能が `VMUX_SOCKET` を自動注入した状態:

```bash
# 通知を送信
vmux notify --title "Claude Code" --body "Task complete"
vmux notify --title "Build" --body "Failed" --level error

# ターミナルを制御
vmux create-terminal --name "agent-1" --cwd /project
vmux list-terminals --json
vmux send --terminal "agent-1" "npm test"
vmux focus --terminal "agent-1"
vmux close --terminal "agent-1"

# セッション管理
vmux save-session --name "dev-setup"
vmux restore-session --name "dev-setup"
vmux list-sessions --json
```

### 3. エージェントフックの設定

**Claude Code** (`~/.claude/settings.json`):
```json
{
  "hooks": {
    "Notification": [{
      "matcher": "idle_prompt",
      "hooks": [{
        "type": "command",
        "command": "vmux notify --title 'Claude Code' --body 'Waiting for input'"
      }]
    }]
  }
}
```

**Codex** (`~/.codex/config.toml`):
```toml
notify = ["bash", "-c", "vmux notify --title Codex --body 'Done'"]
```

追加例: [docs/agent-hooks.md](docs/agent-hooks.md)

## キーボードショートカット

| Shortcut | Description |
|----------|-------------|
| `Cmd+Shift+U` (macOS) / `Ctrl+Shift+U` | 最新の未読通知へ移動 |

## プラットフォーム対応

| Platform | IPC |
|----------|-----|
| macOS | Unix socket (full) |
| Linux | Unix socket (full) |
| Windows | HTTP fallback |

**VS Code**: 最低 1.99、推奨 1.105+

## 開発

```bash
npm install          # 依存関係をインストール
npm run build        # 拡張機能、CLI、MCP サーバーをビルド
npm run watch        # 変更を監視して自動再ビルド
npm test             # 単体テストと統合テストを実行
npm run test:e2e     # VS Code Extension Host で E2E テストを実行
npm run compile      # TypeScript 型チェック
npm run package      # .vsix パッケージをビルド
```

## 技術スタック

TypeScript、esbuild、JSON-RPC 2.0、VS Code Extension API（TreeView、StatusBar、Terminal）、Node.js `net`/`http`

## ドキュメント

- [PRD](docs/PRD.md) — プロダクト要求仕様書
- [Agent Hook Examples](docs/agent-hooks.md) — Claude Code、Codex、Gemini CLI の設定ガイド
- [MCP Demo Scenario](docs/demo-scenario.md) — vmux MCP ツールによるワークフロー例
- [OpenSpec Design](openspec/changes/phase1-core/) — 提案、設計、仕様、タスクチェックリスト

## ライセンス

MIT
