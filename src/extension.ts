import debounce from 'lodash.debounce';
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
    init();

    context.subscriptions.push(
        vscode.window.onDidChangeVisibleTextEditors((editors) => init()),
        vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => maskEditor(vscode.window.activeTextEditor)),
        vscode.window.onDidChangeTextEditorSelection((event: vscode.TextEditorSelectionChangeEvent) => maskEditor(event.textEditor)),
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

function setConfig() {
    const config = vscode.workspace.getConfiguration(PACKAGE_NAME);

    userMasks = config.masks;
}

function init() {
    vscode.window.visibleTextEditors.map((editor) => maskEditor(editor));
}

const maskEditor = debounce((editor: vscode.TextEditor | undefined) => {
    if (editor) {
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
                            text: item.replace,
                            hover: item.hover,
                            backgroundColor: item.style?.backgroundColor,
                            border: item.style?.border,
                            borderColor: item.style?.borderColor,
                            color: item.style?.color,
                            fontStyle: item.style?.fontStyle,
                            fontWeight: item.style?.fontWeight,
                            css: item.style?.css,
                        });
                    }
                }
            }

            if (!old) {
                MaskControllers.push(maskController);
            }

        } catch (err) {
            // console.error(err);
        }
    }
}, 50)

function clearMasks() {
    MaskControllers.map((controller: MaskController) => controller.clear());
}

export function deactivate() { }
