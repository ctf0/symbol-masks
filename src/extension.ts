import * as vscode from "vscode";
import MaskController from "./mask-controller";

const configName: string = 'symbolMasks'
let userMasks: any
let MaskControllers: any = []

export function activate(context: vscode.ExtensionContext) {
    setConfig();
    init();
    events(context);
}

function setConfig() {
    const configuration = vscode.workspace.getConfiguration();

    userMasks = configuration.get(`${configName}.masks`);
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
    vscode.window.onDidChangeActiveTextEditor((editor) => {
        maskCurrentEditor()
    }, null, context.subscriptions);

    vscode.workspace.onDidSaveTextDocument((document) => {
        maskCurrentEditor()
    }, null, context.subscriptions);

    vscode.window.onDidChangeTextEditorSelection((event) => {
        maskCurrentEditor()
    }, null, context.subscriptions);

    vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration(configName)) {
            MaskControllers.map((controller: MaskController) => controller.clear());
            setConfig()
            init();
        }
    }, null, context.subscriptions);
}

export function deactivate() {}
