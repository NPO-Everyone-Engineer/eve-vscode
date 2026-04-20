import * as vscode from 'vscode';
import { EveClient } from './eveClient';

export class ChatProvider implements vscode.WebviewViewProvider {
    private view: vscode.WebviewView | undefined;
    private currentModel: string;

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly client: EveClient
    ) {
        this.currentModel = 'glm-5.1:cloud';
    }

    updateModel(model: string): void {
        this.currentModel = model;
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
                    const config = vscode.workspace.getConfiguration('eve');
                    const autoContext = config.get<boolean>('autoContext', true);
                    let prompt = msg.value as string;

                    // ファイルコンテキスト自動添付
                    if (autoContext) {
                        const context = this.getFileContext();
                        if (context) {
                            prompt = context + '\n---\n' + prompt;
                        }
                    }

                    // ストリーミング送信
                    view.webview.postMessage({ type: 'thinking' });
                    this.client.sendStream(prompt, {
                        onToken: (token) => {
                            view.webview.postMessage({ type: 'stream', value: token });
                        },
                        onDone: (full) => {
                            view.webview.postMessage({ type: 'done', value: full });
                        },
                        onError: (err) => {
                            view.webview.postMessage({ type: 'error', value: err });
                        }
                    });
                    break;
                }
                case 'switchModel': {
                    vscode.commands.executeCommand('eve.switchModel');
                    break;
                }
                case 'toggleContext': {
                    const cfg = vscode.workspace.getConfiguration('eve');
                    const current = cfg.get<boolean>('autoContext', true);
                    cfg.update('autoContext', !current, vscode.ConfigurationTarget.Global);
                    view.webview.postMessage({ type: 'contextToggled', value: !current });
                    break;
                }
            }
        });
    }

    private getFileContext(): string | null {
        const editor = vscode.window.activeTextEditor;
        if (!editor) { return null; }

        const fileName = editor.document.fileName.split('/').pop() || 'unknown';
        const content = editor.document.getText();
        if (!content.trim()) { return null; }

        return `[ファイル: ${fileName}]\n${content}`;
    }

    private getHtml(): string {
        return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>EvE Chat</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/marked/12.0.1/marked.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <style>
        :root {
            --bg: var(--vscode-editor-background);
            --fg: var(--vscode-editor-foreground);
            --accent: #ff6b35;
            --accent-dim: rgba(255,107,53,0.15);
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
            height: calc(100vh - 140px);
            overflow-y: auto;
            padding: 4px;
        }
        .msg {
            margin: 6px 0;
            padding: 8px 10px;
            border-radius: 6px;
            font-size: 13px;
            line-height: 1.6;
            word-break: break-word;
        }
        .msg.user {
            background: var(--accent-dim);
            margin-left: 20px;
        }
        .msg.assistant {
            background: rgba(100,100,100,0.12);
            margin-right: 20px;
        }
        .msg.assistant pre {
            background: rgba(0,0,0,0.3);
            padding: 8px;
            border-radius: 4px;
            overflow-x: auto;
        }
        .msg.assistant code {
            font-family: var(--vscode-editor-font-family, 'Menlo', monospace);
            font-size: 12px;
        }
        .msg.assistant p { margin: 4px 0; }
        .msg.assistant ul, .msg.assistant ol { padding-left: 20px; }
        .thinking {
            text-align: center;
            font-size: 12px;
            opacity: 0.6;
            padding: 8px;
        }
        .thinking::after {
            content: '';
            animation: dots 1.5s infinite;
        }
        @keyframes dots {
            0% { content: ''; }
            33% { content: '.'; }
            66% { content: '..'; }
            100% { content: '...'; }
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
        #footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 4px;
        }
        #context-toggle {
            font-size: 11px;
            opacity: 0.6;
            cursor: pointer;
            background: none;
            border: none;
            color: var(--fg);
        }
        #context-toggle:hover { opacity: 1; }
        .hint {
            font-size: 11px;
            opacity: 0.5;
            text-align: center;
        }
        .streaming-content { display: none; }
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
    <div id="footer">
        <button id="context-toggle">📎 ファイル添付: ON</button>
        <span class="hint" id="status"></span>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const input = document.getElementById('input');
        const send = document.getElementById('send');
        const messages = document.getElementById('messages');
        const switchModel = document.getElementById('switch-model');
        const modelLabel = document.getElementById('model-label');
        const contextToggle = document.getElementById('context-toggle');
        const status = document.getElementById('status');
        let streamingDiv = null;
        let streamingText = '';
        let autoContext = true;
        let renderTimer = null;

        // Markdown設定
        marked.setOptions({
            highlight: function(code, lang) {
                if (lang && hljs.getLanguage(lang)) {
                    return hljs.highlight(code, { language: lang }).value;
                }
                return hljs.highlightAuto(code).value;
            },
            breaks: true
        });

        /**
         * ストリーミングテキストからJSON断片を除去して表示用テキストを抽出
         * eve-cli --output-format json の場合、出力が {"content": "..."} 形式になる
         * ストリーミング中はJSON断片が混じるため、プレーンテキスト部分のみ表示
         */
        function cleanStreamText(raw) {
            // JSON全体が完成している場合はパースを試みる
            try {
                const json = JSON.parse(raw);
                return json.content || json.text || json.response || json.message || raw;
            } catch {
                // JSON断片またはプレーンテキスト
                // JSONの開始記号を除去してプレーンテキストとして扱う
                let cleaned = raw;
                // 未完成のJSONパターンを除去: {"content": " のような開始部分
                cleaned = cleaned.replace(/^\s*\{["\w]+:\s*"/, '');
                // 末尾の " や } を除去
                cleaned = cleaned.replace(/"\s*\}?\s*$/, '');
                return cleaned;
            }
        }

        function addMessage(text, role) {
            const div = document.createElement('div');
            div.className = 'msg ' + role;
            if (role === 'assistant') {
                div.innerHTML = marked.parse(text);
            } else {
                div.textContent = text;
            }
            messages.appendChild(div);
            messages.scrollTop = messages.scrollHeight;
            return div;
        }

        function setThinking() {
            streamingDiv = document.createElement('div');
            streamingDiv.className = 'msg assistant thinking';
            streamingDiv.id = 'streaming';
            streamingDiv.textContent = '🤔 考え中';
            messages.appendChild(streamingDiv);
            messages.scrollTop = messages.scrollHeight;
        }

        /**
         * ストリーミング表示をデバウンス（100ms）
         * 高頻度で来るチャンクをまとめてレンダリングしてパフォーマンス向上
         */
        function scheduleRender() {
            if (renderTimer) { clearTimeout(renderTimer); }
            renderTimer = setTimeout(() => {
                if (streamingDiv) {
                    const cleaned = cleanStreamText(streamingText);
                    streamingDiv.innerHTML = marked.parse(cleaned);
                    messages.scrollTop = messages.scrollHeight;
                }
                renderTimer = null;
            }, 100);
        }

        function doSend() {
            const text = input.value.trim();
            if (!text) return;
            addMessage(text, 'user');
            vscode.postMessage({ type: 'chat', value: text });
            input.value = '';
            send.disabled = true;
            status.textContent = '送信中...';
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

        contextToggle.addEventListener('click', () => {
            autoContext = !autoContext;
            contextToggle.textContent = '📎 ファイル添付: ' + (autoContext ? 'ON' : 'OFF');
            vscode.postMessage({ type: 'toggleContext' });
        });

        window.addEventListener('message', (event) => {
            const msg = event.data;
            switch (msg.type) {
                case 'thinking':
                    setThinking();
                    streamingText = '';
                    break;
                case 'stream':
                    if (!streamingDiv) { setThinking(); }
                    streamingText += msg.value;
                    if (streamingDiv.classList.contains('thinking')) {
                        streamingDiv.classList.remove('thinking');
                        streamingDiv.removeAttribute('id');
                    }
                    scheduleRender();
                    break;
                case 'done':
                    // 最終レンダリング（デバウンス済みのものを即時上書き）
                    if (renderTimer) { clearTimeout(renderTimer); renderTimer = null; }
                    if (streamingDiv) {
                        streamingDiv.innerHTML = marked.parse(msg.value);
                        streamingDiv = null;
                    } else {
                        addMessage(msg.value, 'assistant');
                    }
                    send.disabled = false;
                    status.textContent = '';
                    break;
                case 'error':
                    if (renderTimer) { clearTimeout(renderTimer); renderTimer = null; }
                    if (streamingDiv) {
                        streamingDiv.remove();
                        streamingDiv = null;
                    }
                    addMessage('⚠️ エラー: ' + msg.value, 'assistant');
                    send.disabled = false;
                    status.textContent = '';
                    break;
                case 'model':
                    modelLabel.textContent = msg.value;
                    break;
                case 'contextToggled':
                    autoContext = msg.value;
                    contextToggle.textContent = '📎 ファイル添付: ' + (autoContext ? 'ON' : 'OFF');
                    break;
            }
        });
    </script>
</body>
</html>`;
    }
}