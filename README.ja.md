# vmux — VS Code 向けエージェントフレンドリーなターミナル拡張

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/roboco-io.vmux)](https://marketplace.visualstudio.com/items?itemName=roboco-io.vmux)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md)

Claude Code、Codex、Gemini CLI などの AI コーディングエージェント向けの VS Code ターミナル拡張です。
エージェントがターミナルから通知の送信、セッション管理、メタデータ表示、マルチターミナルワークフローのオーケストレーションを行えます。

> macOS 向けネイティブエージェントターミナル [cmux](https://github.com/manaflow-ai/cmux) に着想を得ています。

## インストール

```bash
# VS Code Marketplace からインストール
code --install-extension roboco-io.vmux

# または VS Code 拡張機能パネルで "vmux" を検索
```

## 機能

### 通知
エージェントから VS Code に通知を送信 — Status Bar バッジ、サイドバー TreeView、システムポップアップ。

```bash
vmux notify --title "Claude Code" --body "Task complete"
vmux notify --title "Build" --body "Failed" --level error
```

### ターミナル制御
ターミナルの作成、フォーカス、コマンド送信、クローズをプログラムから実行。

```bash
vmux create-terminal --name "agent-1" --cwd /project
vmux send --terminal "agent-1" "npm test"
vmux focus --terminal "agent-1"
vmux close --terminal "agent-1"
```

### セッション管理
split グループを含むターミナルレイアウトの保存・復元。

```bash
vmux save-session --name "dev-setup"
vmux restore-session --name "dev-setup"
```

### メタデータパネル
ターミナルごとの status pill、progress bar、構造化ログをサイドバーに表示。

```bash
vmux set-status build passing --icon check
vmux set-progress 0.75 --label "Testing..."
vmux log "All tests passed" --level success
```

### マルチエージェントグリッド
NxM 分割ターミナルグリッドを作成し、すべてにコマンドをブロードキャスト。

```bash
vmux launch-grid --name agents --rows 2 --cols 2
vmux broadcast --grid agents "git pull && npm test"
```

### MCP サーバー
17 個の MCP ツールにより、AI エージェントが Model Context Protocol を通じて vmux を制御。

```json
{
  "mcpServers": {
    "vmux": {
      "command": "node",
      "args": ["/path/to/vmux/dist/mcp.js"],
      "env": { "VMUX_SOCKET": "<ソケットパス>" }
    }
  }
}
```

ツール: `create_terminal`、`send_command`、`create_notification`、`set_status`、`set_progress`、`add_log`、`save_session`、`restore_session`、`launch_agent_grid`、`broadcast_to_grid` など。

## エージェントフック例

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

その他の例: [docs/agent-hooks.md](docs/agent-hooks.md)

## キーボードショートカット

| ショートカット | 説明 |
|----------------|------|
| `Cmd+T` (macOS) / `Ctrl+T` | 新しい vmux ターミナルを作成 |
| `Cmd+Shift+U` (macOS) / `Ctrl+Shift+U` | 最新の未読通知へ移動 |

## アーキテクチャ

![Architecture Overview](docs/images/architecture.png)

## プラットフォーム対応

| プラットフォーム | IPC |
|------------------|-----|
| macOS | Unix socket |
| Linux | Unix socket |
| Windows | HTTP fallback |

**VS Code**: 1.99+

## 開発

```bash
npm install          # 依存関係をインストール
npm run build        # 拡張機能 + CLI + MCP サーバーをビルド
npm run watch        # 変更を監視して自動再ビルド
npm test             # 単体・統合テスト（24 テスト）
npm run test:e2e     # VS Code Extension Host で E2E テスト（7 テスト）
npm run compile      # TypeScript 型チェック
npm run package      # .vsix パッケージをビルド
```

## ドキュメント

- [エージェントフック例](docs/agent-hooks.md)
- [MCP デモシナリオ](docs/demo-scenario.md)
- [コントリビューションガイド](CONTRIBUTING.md)

## ライセンス

MIT
