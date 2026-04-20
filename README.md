# EvE — VS Code Extension

EvE CLI を VS Code から使う拡張機能。

## インストール

```bash
# VSIXからインストール
code --install-extension eve-vscode-0.1.0.vsix
```

## 前提

- [EvE CLI](https://github.com/NPO-Everyone-Engineer/eve-cli) v2.33.0+
- [Ollama](https://ollama.ai) （ローカルLLM実行用）

## 使い方

1. サイドバーの「EvE」アイコンをクリック
2. チャット欄に日本語で指示を入力
3. AIがコードを生成・修正

### コマンド

| コマンド | 説明 |
|---------|------|
| `EvE: チャットを開く` | サイドバーチャットを開く |
| `EvE: 選択範囲をAIに修正させる` | 選択テキストをAIに修正 |
| `EvE: モデルを切り替え` | モデル切替（QuickPick） |
| `EvE: 直前の変更を元に戻す` | /undo 実行 |

### 設定

| 設定 | デフォルト | 説明 |
|------|-----------|------|
| `eve.cliPath` | `eve-cli` | eve-cliのパス |
| `eve.defaultModel` | `qwen3:8b` | デフォルトモデル |
| `eve.autoApprove` | `false` | 自動承認（上級者向け） |

## 開発

```bash
npm install
npm run compile
# F5でデバッグ起動
```

## ライセンス

MIT