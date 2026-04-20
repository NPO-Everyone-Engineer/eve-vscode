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

        proc.stdout.on('data', (data: Buffer) => {
            const chunk = data.toString();
            fullOutput += chunk;
            callbacks.onToken(chunk);
        });

        proc.stderr.on('data', (data: Buffer) => {
            const chunk = data.toString();
            if (chunk.includes('error') || chunk.includes('Error')) {
                callbacks.onError(chunk);
            }
        });

        proc.on('close', (code) => {
            if (fullOutput.trim()) {
                try {
                    const json = JSON.parse(fullOutput);
                    callbacks.onDone(json.content || json.text || fullOutput);
                } catch {
                    callbacks.onDone(fullOutput.trim());
                }
            } else if (code !== 0) {
                callbacks.onError(`eve-cli が終了コード ${code} で終了しました`);
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