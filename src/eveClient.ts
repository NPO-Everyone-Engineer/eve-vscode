import { ChildProcess, spawn } from 'child_process';

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

    async send(prompt: string): Promise<string | null> {
        return new Promise((resolve, reject) => {
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

            let stdout = '';
            let stderr = '';

            proc.stdout.on('data', (data: Buffer) => {
                stdout += data.toString();
            });

            proc.stderr.on('data', (data: Buffer) => {
                stderr += data.toString();
            });

            proc.on('close', (code) => {
                if (code !== 0 && !stdout) {
                    reject(new Error(`eve-cli exited with code ${code}: ${stderr}`));
                    return;
                }
                try {
                    // JSON出力からテキストを抽出
                    const json = JSON.parse(stdout);
                    resolve(json.content || json.text || stdout);
                } catch {
                    // プレーンテキストの場合
                    resolve(stdout.trim());
                }
            });

            proc.on('error', (err) => {
                reject(new Error(`eve-cli起動失敗: ${err.message}`));
            });

            // タイムアウト（5分）
            setTimeout(() => {
                proc.kill();
                resolve(stdout.trim() || null);
            }, 300000);
        });
    }

    dispose(): void {
        if (this.proc) {
            this.proc.kill();
        }
    }
}