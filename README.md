# Symbol Masks

based on https://github.com/stevengeeky/symbol-masks + fixes/enhancements

## New

- support masking all visibleTextEditors instead of currently active only
- remove `scope` config which was giving error
- remove incorrect pkg default config
- remove screenshots folder & make the ext size smaller
- reset background default
- API for other extensions to consume

## Usage

Specify a pattern that will match a symbol to be masked in your settings.json file:

```json
"symbolMasks.masks": [
  {
    "language": "plaintext",
    "patterns": [
        {
            "pattern": "(?<=\\b)lambda(?=\\b)",
            "replace": "λ",
            "style": {
              "fontWeight": "bold"
            }
        }
    ]
  }
]
```

### Mask Multiple Symbols At Once

For efficiency, you can also match many symbols at once and map each of them to an individual mask:

```json
"symbolMasks.masks": [
  {
    "language": ["plaintext", "json"],
    "patterns": [
        {
            "pattern": "(?<=\\b)(lambda|omega)(?=\\b)",
            "replace": {
              "lambda": {
                  "text": "λ",
                  "fontWeight": "bold"
              },
              "omega": {
                  "text": "ω"
              }
            }
        }
    ]
  }
]
```

## API

[Read More](https://code.visualstudio.com/api/references/vscode-api#extensions)

```js
const maskExtension = vscode.extensions.getExtension("ctf0.symbol-masks-new");

if (maskExtension == null) {
    throw new Error("Depends on 'ctf0.symbol-masks-new' extension");
}

const MASK_EXTENSION_PROVIDER = await maskExtension.activate();

// now u can use it like so

MASK_EXTENSION_PROVIDER.addAdditionalMasks(maskPatternsArray)
MASK_EXTENSION_PROVIDER.clearMaskDecorations()
```
