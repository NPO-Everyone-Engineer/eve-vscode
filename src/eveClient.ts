import { ChildProcess, spawn } from 'child_process';

export interface StreamCallbacks {
    onToken: (token: string) => void;
    onDone: (full: string) => void;
    onError: (err: string) => void;
}

export class EveClient {
    private cliPath: string;
    private model: string;
    private proc: ChildProcess | null = null;

    constructor(cliPath: string, model: string) {
        this.cliPath = cliPath;
        this.model = model;
    }

    switchModel(model: string): void {
        this.model = model;
    }

    /**
     * JSON出力からテキストを抽出する
     * eve-cli --output-format json の場合: {"content": "...", "text": "..."} 形式
     * ストリーミング中は不完全なJSONが来るため、完成時のみパースを試みる
     */
    private extractText(rawOutput: string): string {
        const trimmed = rawOutput.trim();
        if (!trimmed) { return ''; }

        // JSONパースを試みる
        try {
            const json = JSON.parse(trimmed);
            return json.content || json.text || json.response || json.message || trimmed;
        } catch {
            // JSONでなければそのまま返す
            return trimmed;
        }
    }

    /**
     * ストリーミングチャンクから表示用テキストを抽出する
     * 不完全なJSON断片はそのまま表示（完了時に正しくパースされる）
     */
    private extractStreamChunk(chunk: string): string {
        // JSONの断片（{や"で始まる）はそのまま表示
        // プレーンテキストはそのまま表示
        return chunk;
    }

    /**
     * ストリーミング送信（リアルタイム表示用）
     */
    sendStream(prompt: string, callbacks: StreamCallbacks): ChildProcess {
        const args = [
            '--headless',
            '--output-format', 'json',
            '--model', this.model,
            '-p', prompt,
            '-y'
        ];

        const proc = spawn(this.cliPath, args, {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let fullOutput = '';
        let stderrOutput = '';

        proc.stdout.on('data', (data: Buffer) => {
            const chunk = data.toString();
            fullOutput += chunk;
            // ストリーミング中はそのまま表示（JSON断片も含む）
            callbacks.onToken(this.extractStreamChunk(chunk));
        });

        proc.stderr.on('data', (data: Buffer) => {
            stderrOutput += data.toString();
        });

        proc.on('close', (code) => {
            if (fullOutput.trim()) {
                // 完了時にJSONパースを試みて、テキストを抽出
                const text = this.extractText(fullOutput);
                callbacks.onDone(text);
            } else if (code !== 0) {
                const errMsg = stderrOutput.trim() || `eve-cli が終了コード ${code} で終了しました`;
                callbacks.onError(errMsg);
            }
        });

        proc.on('error', (err) => {
            callbacks.onError(`eve-cli起動失敗: ${err.message}`);
        });

        this.proc = proc;
        return proc;
    }

    /**
     * 一括送信（後方互換用）
     */
    async send(prompt: string): Promise<string | null> {
        return new Promise((resolve, reject) => {
            this.sendStream(prompt, {
                onToken: () => {},
                onDone: resolve,
                onError: (err) => reject(new Error(err))
            });

            // タイムアウト（5分）
            setTimeout(() => {
                this.kill();
                resolve(null);
            }, 300000);
        });
    }

    /**
     * Ollamaが起動しているか確認
     */
    async checkOllama(): Promise<boolean> {
        try {
            const response = await fetch('http://localhost:11434/api/tags');
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * 利用可能なモデル一覧を取得
     */
    async listModels(): Promise<string[]> {
        try {
            const response = await fetch('http://localhost:11434/api/tags');
            const data = await response.json() as { models: Array<{ name: string }> };
            return data.models.map(m => m.name);
        } catch {
            return [];
        }
    }

    /**
     * eve-cliが見つかるか確認
     */
    async checkCliInstalled(): Promise<boolean> {
        return new Promise((resolve) => {
            const proc = spawn('which', [this.cliPath], { stdio: 'pipe' });
            proc.on('close', (code) => resolve(code === 0));
            proc.on('error', () => resolve(false));
        });
    }

    kill(): void {
        if (this.proc && !this.proc.killed) {
            this.proc.kill();
        }
    }

    dispose(): void {
        this.kill();
    }
}