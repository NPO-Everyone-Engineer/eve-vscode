import * as vscode from 'vscode';
import { EveClient } from './eveClient';

export class ChatProvider implements vscode.WebviewViewProvider {
    private view: vscode.WebviewView | undefined;
    private currentModel: string;

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly client: EveClient
    ) {
        this.currentModel = 'qwen3:8b';
    }

    updateModel(model: string): void {
        this.currentModel = model;
        this.updateStatusBar();
    }

    private updateStatusBar(): void {
        if (this.view) {
            this.view.webview.postMessage({ type: 'model', value: this.currentModel });
        }
    }

    resolveWebviewView(view: vscode.WebviewView): void {
        this.view = view;

        view.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri]
        };

        view.webview.html = this.getHtml();

        view.webview.onDidReceiveMessage(async (msg) => {
            switch (msg.type) {
                case 'chat': {
                    const response = await this.client.send(msg.value);
                    view.webview.postMessage({ type: 'response', value: response || '（応答なし）' });
                    break;
                }
                case 'switchModel': {
                    vscode.commands.executeCommand('eve.switchModel');
                    break;
                }
            }
        });
    }

    private getHtml(): string {
        return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>EvE Chat</title>
    <style>
        :root {
            --bg: var(--vscode-editor-background);
            --fg: var(--vscode-editor-foreground);
            --accent: #ff6b35;
        }
        body {
            font-family: var(--vscode-font-family);
            color: var(--fg);
            background: var(--bg);
            padding: 8px;
            margin: 0;
        }
        #header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        #model-label {
            font-size: 11px;
            opacity: 0.7;
        }
        #messages {
            height: calc(100vh - 120px);
            overflow-y: auto;
            padding: 4px;
        }
        .msg {
            margin: 6px 0;
            padding: 6px 8px;
            border-radius: 6px;
            font-size: 13px;
            line-height: 1.5;
            white-space: pre-wrap;
            word-break: break-word;
        }
        .msg.user {
            background: rgba(255,107,53,0.15);
            margin-left: 20px;
        }
        .msg.assistant {
            background: rgba(100,100,100,0.15);
            margin-right: 20px;
        }
        #input-area {
            display: flex;
            gap: 6px;
            margin-top: 8px;
        }
        #input {
            flex: 1;
            padding: 6px 8px;
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 4px;
            background: rgba(255,255,255,0.05);
            color: var(--fg);
            font-size: 13px;
        }
        #input:focus {
            border-color: var(--accent);
            outline: none;
        }
        #send {
            padding: 6px 12px;
            background: var(--accent);
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
        }
        #send:hover { opacity: 0.9; }
        #send:disabled { opacity: 0.5; cursor: default; }
        .hint {
            font-size: 11px;
            opacity: 0.5;
            margin-top: 4px;
            text-align: center;
        }
    </style>
</head>
<body>
    <div id="header">
        <span style="font-weight:bold;">🤖 EvE</span>
        <span id="model-label">${this.currentModel}</span>
        <button id="switch-model" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:11px;">切替</button>
    </div>
    <div id="messages">
        <div class="hint">日本語で話しかけてOK。AIがコードを書きます。</div>
    </div>
    <div id="input-area">
        <input id="input" placeholder="日本語で指示..." autofocus />
        <button id="send">送信</button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const input = document.getElementById('input');
        const send = document.getElementById('send');
        const messages = document.getElementById('messages');
        const switchModel = document.getElementById('switch-model');
        const modelLabel = document.getElementById('model-label');

        function addMessage(text, role) {
            const div = document.createElement('div');
            div.className = 'msg ' + role;
            div.textContent = text;
            messages.appendChild(div);
            messages.scrollTop = messages.scrollHeight;
        }

        function doSend() {
            const text = input.value.trim();
            if (!text) return;
            addMessage(text, 'user');
            vscode.postMessage({ type: 'chat', value: text });
            input.value = '';
            send.disabled = true;
        }

        send.addEventListener('click', doSend);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                doSend();
            }
        });

        switchModel.addEventListener('click', () => {
            vscode.postMessage({ type: 'switchModel' });
        });

        window.addEventListener('message', (event) => {
            const msg = event.data;
            if (msg.type === 'response') {
                addMessage(msg.value, 'assistant');
                send.disabled = false;
            } else if (msg.type === 'model') {
                modelLabel.textContent = msg.value;
            }
        });
    </script>
</body>
</html>`;
    }
}