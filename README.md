# EvE — VS Code Extension

EvE CLI を VS Code から使う AI コーディングエージェント拡張機能。日本語で指示するだけで AI がコードを生成・修正します。

## インストール

```bash
# VSIX からインストール
code --install-extension eve-vscode-0.2.0.vsix
```

## 前提

- [EvE CLI](https://github.com/NPO-Everyone-Engineer/eve-cli) v2.33.0+
- [Ollama](https://ollama.ai)（ローカル LLM 実行用）

## 使い方

1. サイドバーの「EvE」アイコンをクリック
2. チャット欄に日本語で指示を入力
3. AI がコードを生成・修正

初回起動時にはセットアップウィザードが自動で開き、EvE CLI / Ollama の状態を確認できます。

### 主な機能

- **ストリーミング表示**: AI の回答をリアルタイムに表示
- **マルチターン会話**: 会話の文脈を保持した継続的なやりとり
- **履歴永続化**: 会話履歴を VS Code の globalState に保存（最大 50 メッセージ）
- **動的モデル一覧**: Ollama から利用可能なモデルを自動取得
- **コードコピー**: AI の回答内のコードブロックをワンクリックでコピー
- **中断ボタン**: 実行中の AI 処理を中断
- **ファイルコンテキスト**: 開いているファイルを自動で AI に添付
- **Markdown 表示**: AI の回答を整形済み Markdown で表示

### コマンド

| コマンド | 説明 |
|---------|------|
| `EvE: チャットを開く` | サイドバーチャットを開く |
| `EvE: 選択範囲をAIに修正させる` | 選択テキストを AI に修正 |
| `EvE: モデルを切り替え` | モデル切替（QuickPick） |
| `EvE: 直前の変更を元に戻す` | /undo 実行 |
| `EvE: セットアップウィザード` | EvE CLI / Ollama の状態確認 |

### 設定

| 設定 | デフォルト | 説明 |
|------|-----------|------|
| `eve.cliPath` | `eve-cli` | eve-cli のパス |
| `eve.defaultModel` | `glm-5.1:cloud` | デフォルトモデル |
| `eve.autoApprove` | `false` | ツール実行の自動承認（上級者向け） |
| `eve.autoContext` | `true` | 開いているファイルを自動で AI に添付 |

## 開発

```bash
npm install
npm run compile
# F5 でデバッグ起動
```

## ライセンス

MIT
