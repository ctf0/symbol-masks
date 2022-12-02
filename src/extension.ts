import * as vscode from "vscode";
import MaskController from "./mask-controller";

const PACKAGE_NAME: string = 'symbolMasks'
let userMasks: any = []
let MaskControllers: any = []

interface MaskConfigObject { // define the object (singular)
    language: string;
    patterns: Array<object>;
}

export function activate(context: vscode.ExtensionContext) {
    setConfig();
    init()
    events(context);

    return {
        addAdditionalMasks(masks: MaskConfigObject[]) {
            if (masks.length) {
                userMasks = userMasks.concat(masks)
                init()
            }
        },
        clearMaskDecorations() {
            clearMasks()
        }
    }
}

function setConfig() {
    const config = vscode.workspace.getConfiguration(PACKAGE_NAME);

    userMasks = config.masks;
}

function init() {
    vscode.window.visibleTextEditors.map((editor) => maskEditor(editor));
}

function maskCurrentEditor() {
    maskEditor(vscode.window.activeTextEditor);
}

function maskEditor(editor: vscode.TextEditor | undefined) {
    let old = MaskControllers.find((item: MaskController) => item.getEditor() === editor)

    // A map from language id => mask
    const maskMap = new Map<string, any>();
    const maskController = old || new MaskController(editor);
    let timeout: NodeJS.Timeout;

    async function updateMasks () {
        try {
            const document = maskController.getEditor()?.document;

            if (document) {
                for (let mask of userMasks) {
                    if (vscode.languages.match(mask.language, document) > 0) {
                        maskMap.set(mask.language, mask.pattern);

                        for (const pattern of mask.patterns) {
                            const regex = new RegExp(pattern.pattern, pattern.ignoreCase ? "ig" : "g");

                            maskController.apply(regex, {
                                text: pattern.replace,
                                hover: pattern.hover,
                                backgroundColor: pattern.style?.backgroundColor,
                                border: pattern.style?.border,
                                borderColor: pattern.style?.borderColor,
                                color: pattern.style?.color,
                                fontStyle: pattern.style?.fontStyle,
                                fontWeight: pattern.style?.fontWeight,
                                css: pattern.style?.css
                            });
                        }
                    }
                }
            }
        } catch (err) {
            console.error(err);
        }
    };

    /**
     * Wait a little before updating the masks
     * To avoid slowing the extension down
     */
    function debounceUpdateMasks () {
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(updateMasks, 50);
    };

    debounceUpdateMasks();

    if (!old) {
        MaskControllers.push(maskController)
    }
}

function events(context: vscode.ExtensionContext) {
    vscode.window.onDidChangeVisibleTextEditors((editor) => {
        init()
    }, null, context.subscriptions);

    vscode.workspace.onDidSaveTextDocument((document) => {
        maskCurrentEditor()
    }, null, context.subscriptions);

    vscode.window.onDidChangeTextEditorSelection((event) => {
        maskCurrentEditor()
    }, null, context.subscriptions);

    vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration(PACKAGE_NAME)) {
            clearMasks()
            setConfig()
            init()
        }
    }, null, context.subscriptions);
}

function clearMasks() {
    MaskControllers.map((controller: MaskController) => controller.clear());
}

export function deactivate() {}
