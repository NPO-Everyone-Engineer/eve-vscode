import * as vscode from 'vscode';
import { EveClient } from './eveClient';
import { ChatProvider } from './chatView';
import { SetupWizard } from './setupWizard';

let eveClient: EveClient;
let chatProvider: ChatProvider;

export function activate(context: vscode.ExtensionContext) {
    const config = vscode.workspace.getConfiguration('eve');
    const cliPath = config.get<string>('cliPath', 'eve-cli');
    const defaultModel = config.get<string>('defaultModel', 'glm-5.1:cloud');

    eveClient = new EveClient(cliPath, defaultModel);
    chatProvider = new ChatProvider(context.extensionUri, eveClient);

    // Webview登録
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('eve.chatView', chatProvider)
    );

    // コマンド登録
    context.subscriptions.push(
        vscode.commands.registerCommand('eve.chat', () => {
            vscode.commands.executeCommand('workbench.view.extension.eve-chat');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('eve.editSelection', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('エディタを開いてください');
                return;
            }
            const selection = editor.document.getText(editor.selection);
            if (!selection) {
                vscode.window.showWarningMessage('テキストを選択してください');
                return;
            }
            const instruction = await vscode.window.showInputBox({
                prompt: 'AIにどう修正させますか？（日本語でOK）',
                placeHolder: '例: バグを修正して、エラーハンドリングを追加して'
            });
            if (!instruction) { return; }

            const autoContext = config.get<boolean>('autoContext', true);
            let prompt = `次のコードを修正してください。\n指示: ${instruction}\n\nコード:\n${selection}`;

            const result = await eveClient.send(prompt);
            if (result) {
                editor.edit(builder => {
                    builder.replace(editor.selection, result);
                });
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('eve.switchModel', async () => {
            const models = ['glm-5.1:cloud', 'kimi-k2.5:cloud', 'qwen3.5:397b-cloud', 'gemma4:31b-cloud', 'qwen3:8b', 'qwen3:4b'];
            const picked = await vscode.window.showQuickPick(models, {
                placeHolder: 'モデルを選択'
            });
            if (picked) {
                eveClient.switchModel(picked);
                chatProvider.updateModel(picked);
                vscode.window.showInformationMessage(`モデルを ${picked} に切り替えました`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('eve.undoLast', async () => {
            const result = await eveClient.send('/undo');
            vscode.window.showInformationMessage(result || '元に戻しました');
        })
    );

    // セットアップウィザード
    context.subscriptions.push(
        vscode.commands.registerCommand('eve.setup', () => {
            const wizard = new SetupWizard(eveClient);
            wizard.show();
        })
    );

    // 初回起動時にセットアップ表示
    const shown = context.globalState.get('eve.setupShown', false);
    if (!shown) {
        vscode.commands.executeCommand('eve.setup');
        context.globalState.update('eve.setupShown', true);
    }

    vscode.window.showInformationMessage('EvE拡張を起動しました 🤖✨');
}

export function deactivate() {
    eveClient?.dispose();
}