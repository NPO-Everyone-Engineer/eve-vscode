import * as vscode from 'vscode';
import { EveClient } from './eveClient';

export class SetupWizard {
    private client: EveClient;

    constructor(client: EveClient) {
        this.client = client;
    }

    async check(): Promise<SetupResult> {
        const results: CheckItem[] = [];

        // 1. Ollama起動確認
        const ollamaOk = await this.client.checkOllama();
        results.push({
            label: 'Ollama',
            ok: ollamaOk,
            detail: ollamaOk
                ? 'Ollamaが起動しています ✅'
                : 'Ollamaが起動していません。ターミナルで `ollama serve` を実行してください。'
        });

        // 2. eve-cli確認
        const cliOk = await this.client.checkCliInstalled();
        results.push({
            label: 'EvE CLI',
            ok: cliOk,
            detail: cliOk
                ? 'eve-cliが見つかりました ✅'
                : 'eve-cliが見つかりません。`pip install eve-cli` でインストールしてください。'
        });

        // 3. モデル一覧
        const models = ollamaOk ? await this.client.listModels() : [];
        const modelOk = models.length > 0;
        results.push({
            label: 'モデル',
            ok: modelOk,
            detail: modelOk
                ? `${models.length}個のモデルが利用可能: ${models.slice(0, 5).join(', ')}${models.length > 5 ? '...' : ''}`
                : 'モデルが見つかりません。`ollama pull glm-5.1:cloud` 等でダウンロードしてください。'
        });

        const allOk = results.every(r => r.ok);
        return { items: results, allOk };
    }

    async show(): Promise<void> {
        const result = await this.check();

        const panel = vscode.window.createWebviewPanel(
            'eveSetup',
            'EvE セットアップ',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        panel.webview.html = this.getSetupHtml(result);

        panel.webview.onDidReceiveMessage(async (msg) => {
            switch (msg.type) {
                case 'recheck': {
                    const r = await this.check();
                    panel.webview.html = this.getSetupHtml(r);
                    break;
                }
                case 'close':
                    panel.dispose();
                    break;
            }
        });
    }

    private getSetupHtml(result: SetupResult): string {
        const items = result.items.map(item => {
            const icon = item.ok ? '✅' : '❌';
            return `<div class="check-item ${item.ok ? 'ok' : 'ng'}">
                <span class="icon">${icon}</span>
                <span class="label">${item.label}</span>
                <span class="detail">${item.detail}</span>
            </div>`;
        }).join('\n');

        const statusHtml = result.allOk
            ? '<div class="success">🎉 準備完了！チャットを始めましょう</div>'
            : '<div class="warning">⚠️ いくつかの項目を修正してください</div>';

        return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <title>EvE セットアップ</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-editor-foreground);
            background: var(--vscode-editor-background);
            padding: 24px;
            max-width: 600px;
            margin: 0 auto;
        }
        h1 { color: #ff6b35; }
        h2 { margin-top: 24px; }
        .check-item {
            padding: 12px 16px;
            margin: 8px 0;
            border-radius: 6px;
            border: 1px solid rgba(255,255,255,0.1);
        }
        .check-item.ok { background: rgba(100,200,100,0.1); }
        .check-item.ng { background: rgba(255,100,100,0.1); }
        .icon { font-size: 18px; margin-right: 8px; }
        .label { font-weight: bold; margin-right: 8px; }
        .detail { font-size: 13px; opacity: 0.8; }
        .success {
            background: rgba(100,200,100,0.15);
            border: 1px solid rgba(100,200,100,0.3);
            padding: 16px;
            border-radius: 8px;
            margin-top: 16px;
            font-size: 16px;
            text-align: center;
        }
        .warning {
            background: rgba(255,200,100,0.15);
            border: 1px solid rgba(255,200,100,0.3);
            padding: 16px;
            border-radius: 8px;
            margin-top: 16px;
            font-size: 16px;
            text-align: center;
        }
        .actions { margin-top: 20px; text-align: center; }
        button {
            padding: 8px 20px;
            margin: 0 8px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        }
        .btn-primary { background: #ff6b35; color: white; }
        .btn-secondary { background: rgba(255,255,255,0.1); color: var(--vscode-editor-foreground); }
    </style>
</head>
<body>
    <h1>🤖 EvE へようこそ！</h1>
    <p>AIコーディングアシスタント「EvE」のセットアップ状況を確認します。</p>

    <h2>チェック結果</h2>
    ${items}

    ${statusHtml}

    <div class="actions">
        <button class="btn-primary" onclick="recheck()">再チェック</button>
        <button class="btn-secondary" onclick="closePanel()">閉じる</button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        function recheck() { vscode.postMessage({ type: 'recheck' }); }
        function closePanel() { vscode.postMessage({ type: 'close' }); }
    </script>
</body>
</html>`;
    }
}

interface CheckItem {
    label: string;
    ok: boolean;
    detail: string;
}

interface SetupResult {
    items: CheckItem[];
    allOk: boolean;
}