import * as vscode from 'vscode';

const DECOR_KEY_SUFFIX = '@@@';

/**
 * An alternative to passing in a string
 * to match.text. A match based replace
 * is much more efficient in many
 * cases
 */
interface MatchBasedReplace {
    [match: string]: {
        text: string,
        hover?: string,
        backgroundColor?: string,
        border?: string,
        borderColor?: string,
        color?: string,
        fontStyle?: string,
        fontWeight?: string,
        css?: string
    }
}

export interface Mask {
    /**
     * The text to display in place of the
     * original symbol
     */
    text?: string | MatchBasedReplace
    /**
     * The text to show when the decorator is hovered over
     */
    hover?: string,
    /**
     * backgroundColor CSS value
     * for the new symbol
     */
    backgroundColor?: string
    /**
     * border CSS value for the new symbol
     */
    border?: string
    /**
     * borderColor CSS value for the new symbol
     */
    borderColor?: string
    /**
     * color CSS value for the new symbol
     */
    color?: string
    /**
     * fontStyle CSS value for the new symbol
     */
    fontStyle?: string
    /**
     * fontWeight CSS value for the new symbol
     */
    fontWeight?: string
    /**
     * Custom CSS to inject into the mask
     */
    css?: string
}

/**
 * A class for creating and applying masks to a document
 */
export default class MaskController {
    private decorationTypeMap: Map<string, vscode.TextEditorDecorationType>;

    private editor: vscode.TextEditor | undefined;

    constructor(editor?: vscode.TextEditor) {
        this.setEditor(editor);
        this.decorationTypeMap = new Map();
    }

    public getEditor() {
        return this.editor;
    }

    public setEditor(editor?: vscode.TextEditor) {
        this.editor = editor;
    }

    /**
     * Clear all existing masks
     */
    public clear() {
        const editor = this.getEditor();

        if (editor) {
            for (const key of this.decorationTypeMap.keys()) {
                const decorationType = this.decorationTypeMap.get(key);

                if (decorationType) {
                    editor.setDecorations(decorationType, []);
                }
            }
        }

        this.decorationTypeMap.clear();
    }

    /**
     * Initialize new decorations to render on the document
     */
    private initialize(id: string, mask: Mask) {
        if (!this.decorationTypeMap.has(id)) {
            this.decorationTypeMap.set(
                id,
                vscode.window.createTextEditorDecorationType({
                    // Hide the actual character
                    textDecoration : mask.text ? 'none;font-size:0;line-height:1' : 'none',
                    before         : {
                        // Render the mask text if provided
                        contentText     : typeof mask.text === 'string' ? mask.text : undefined,
                        backgroundColor : mask.backgroundColor,
                        border          : mask.border,
                        borderColor     : mask.borderColor,
                        color           : mask.color,
                        fontStyle       : mask.fontStyle,
                        fontWeight      : mask.fontWeight + (mask.css ? `;${mask.css}` : ''),
                    },
                }),
            );
        }
    }

    /**
     * Decorate all matches of a given pattern with the given mask
     * @param pattern The pattern to match
     * @param mask The mask to apply to all matches of the given pattern
     */
    public apply(pattern: RegExp, mask: Mask) {
        const editor = this.getEditor();

        if (!editor) {
            return;
        }

        if (!this.decorationTypeMap.has(pattern.source)) {
            this.initialize(pattern.source, mask);
        }

        const text = editor.document.getText();
        const decorationOptions: Map<string, vscode.DecorationOptions[]> = new Map();
        const matchReplaceKeys: Set<string> = new Set();

        // The block and underline style cursors disappear one character before
        // the decorated mask, so styling is removed one character early for them
        const cursorStyle: string = vscode.workspace.getConfiguration().get('editor.cursorStyle') || '';

        let match: RegExpExecArray | null;
        while (match = pattern.exec(text)) {
            if (match[0].length === 0) {
                break;
            }
            const startPos = editor.document.positionAt(match.index);
            const endPos = editor.document.positionAt(match.index + match[0].length);

            let decorateSymbol = false;

            // Detect if there is a match based replacement
            let matchReplace: MatchBasedReplace[keyof MatchBasedReplace] | undefined;

            if (mask.text && typeof mask.text !== 'string') {
                if (match[0] in mask.text) {
                    matchReplace = mask.text[match[0]];
                }
            }

            // For all carets
            for (const selection of editor.selections) {
                let selectionStart = editor.document.offsetAt(selection.start);
                let selectionEnd = editor.document.offsetAt(selection.end);

                if (selectionEnd < selectionStart) {
                    const tmp = selectionStart;
                    selectionStart = selectionEnd;
                    selectionEnd = tmp;
                }

                // Reveal the actual symbol if this selection intersects with it
                const check = selectionStart <= match.index + match[0].length;

                if (cursorStyle.startsWith('line')) {
                    if (selectionEnd >= match.index && check) {
                        decorateSymbol = false;
                        break;
                    }
                } else {
                    if (selectionEnd >= match.index - 1 && check) {
                        decorateSymbol = false;
                        break;
                    }
                }

                // No need to recheck whether or not decoration
                // should happen if it's already been determined
                // by another selection
                if (decorateSymbol) {
                    continue;
                }

                decorateSymbol = true;
            }

            // If none of the selections intersect with the symbol
            if (decorateSymbol) {
                let decorationKey = pattern.source;
                let hover = mask.hover;

                if (matchReplace?.text) {
                    decorationKey += `${DECOR_KEY_SUFFIX}${matchReplace.text}`;

                    if (!matchReplaceKeys.has(decorationKey)) {
                        matchReplaceKeys.add(decorationKey);
                        this.initialize(decorationKey, {
                            text            : matchReplace.text,
                            backgroundColor : matchReplace.backgroundColor,
                            border          : matchReplace.border,
                            borderColor     : matchReplace.borderColor,
                            color           : matchReplace.color,
                            fontStyle       : matchReplace.fontStyle,
                            fontWeight      : matchReplace.fontWeight,
                            css             : matchReplace.css,
                        });
                    }

                    hover = matchReplace.hover;
                }

                if (!decorationOptions.has(decorationKey)) {
                    decorationOptions.set(decorationKey, []);
                }

                decorationOptions.get(decorationKey)?.push({
                    range        : new vscode.Range(startPos, endPos),
                    hoverMessage : hover,
                });
            } else {
                // clear cursor intersected mask
                for (const key of this.decorationTypeMap.keys()) {
                    const cleanKey = key.replace(new RegExp(`${DECOR_KEY_SUFFIX}.*`), '');
                    const currentLineText = !matchReplaceKeys.has(key);

                    if (key.includes(DECOR_KEY_SUFFIX) && cleanKey === pattern.source && currentLineText) {
                        const decorationType = this.decorationTypeMap.get(key);

                        if (decorationType) {
                            editor.setDecorations(decorationType, []);
                        }

                        this.decorationTypeMap.delete(key);
                    }
                }
            }
        }

        for (const decorationKey of matchReplaceKeys.values()) {
            const decorationType = this.decorationTypeMap.get(decorationKey);

            if (decorationType) {
                editor.setDecorations(decorationType, decorationOptions.get(decorationKey) || []);
            }
        }

        const decorationType = this.decorationTypeMap.get(pattern.source);

        if (decorationType) {
            editor.setDecorations(decorationType, decorationOptions.get(pattern.source) || []);
        }
    }
}
