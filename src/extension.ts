import pDebounce from 'p-debounce';
import * as vscode from 'vscode';
import MaskController from './mask-controller';

const PACKAGE_NAME = 'symbolMasks';
let userMasks: any = [];
let extraMasks: any = [];
const MaskControllers: any = [];

interface MaskConfigObject { // define the object (singular)
    language: string;
    patterns: Array<object>;
}

export function activate(context: vscode.ExtensionContext) {
    setConfig();

    context.subscriptions.push(
        vscode.window.onDidChangeVisibleTextEditors((editors) => init()),
        vscode.workspace.onDidSaveTextDocument(async (document: vscode.TextDocument) => {
            const editor = activeEditor();

            MaskControllers.find((item: MaskController) => item.getEditor() === editor)?.clear();
            await maskEditor(editor);
        }),
        vscode.window.onDidChangeTextEditorSelection(pDebounce(async (event: vscode.TextEditorSelectionChangeEvent) => await maskEditor(event.textEditor), 100)),
        vscode.workspace.onDidChangeConfiguration((event: vscode.ConfigurationChangeEvent) => {
            if (event.affectsConfiguration(PACKAGE_NAME)) {
                clearMasks();
                setConfig();
                init();
            }
        }),
    );

    return {
        addAdditionalMasks(masks: MaskConfigObject[]) {
            if (masks.length) {
                extraMasks = masks;
                init();
            }
        },
        clearMaskDecorations() {
            clearMasks();
        },
    };
}

function activeEditor(): vscode.TextEditor | undefined {
    return vscode.window.activeTextEditor;
}

function setConfig() {
    const config = vscode.workspace.getConfiguration(PACKAGE_NAME);

    userMasks = config.masks;
}

function init() {
    vscode.window.visibleTextEditors.map(async (editor) => await maskEditor(editor));
}

function maskEditor(editor: vscode.TextEditor | undefined) {
    return new Promise((resolve, reject) => {
        if (!editor) {
            reject(false);
        }

        const old: MaskController | undefined = MaskControllers.find((item: MaskController) => item.getEditor() === editor);

        // A map from language id => mask
        const maskController = old || new MaskController(editor);

        try {
            const { document } = editor;

            for (const mask of userMasks.concat(extraMasks)) {
                if (vscode.languages.match(mask.language, document) > 0) {
                    for (const item of mask.patterns) {
                        const regex = new RegExp(item.pattern, item.ignoreCase ? 'ig' : 'g');

                        maskController.apply(regex, {
                            text            : item.replace,
                            hover           : item.hover,
                            backgroundColor : item.style?.backgroundColor,
                            border          : item.style?.border,
                            borderColor     : item.style?.borderColor,
                            color           : item.style?.color,
                            fontStyle       : item.style?.fontStyle,
                            fontWeight      : item.style?.fontWeight,
                            css             : item.style?.css,
                        });
                    }
                }
            }

            if (!old) {
                MaskControllers.push(maskController);
            }

            setTimeout(resolve, 50);
        } catch (err) {
            // console.error(err);
        }
    });
}

function clearMasks() {
    MaskControllers.map((controller: MaskController) => controller.clear());
}

export function deactivate() { }
