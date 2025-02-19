# Gemini Coder

Free and open-source AI coding toolkit for Gemini and beyond.

Effortless one-click web chat initialization with your instruction and a hand-picked context. Supports Gemini, AI Studio, ChatGPT, Claude, GitHub Copilot and DeepSeek.

The goal of this extension is to ensure the same sleek developer experience with all the major AI providers within the Web environment no matter if you commited to any one of them or just are fine with testing their free tiers.

- [Install for Chrome](https://chromewebstore.google.com/detail/gemini-coder-connector/ljookipcanaglfaocjbgdicfbdhhjffp)
- [Install for Firefox](https://addons.mozilla.org/en-US/firefox/addon/gemini-coder-connector/)

[![ScreenCast](https://github.com/robertpiosik/gemini-coder/raw/HEAD/packages/vscode/resources/screencast.gif)]()

## Features

- Workspace explorer tree for context selection.
- Automatically initialized web chats in Gemini & AI Studio (and more).
- FIM completions at the cursor position.
- Applying suggested code changes.
- File refactoring with instruction.
- API provider agnostic, read more in "Set up custom providers" section below.
- Supports other web chats as well: ChatGPT, Claude, Github Copilot, DeepSeek, Open WebUI (self-hosted).

## How to use FIM completions

1.  Open the Context View and select all relevant folders/files you want to attach as context in each request.
2.  Place the cursor where you want to insert code completion.
3.  Open the Command Palette (`Ctrl+Shift+P`).
4.  Type `Gemini Coder: Request FIM completion`.
5.  Bind command to a key combination of your choice in `Preferences: Open Keyboard Shortcuts`, e.g., `Ctrl+P` for `Gemini Coder: Request FIM completion`.

## Commands

#### FIM completions

- `Gemini Coder: Request FIM completion` - Get fill-in-the-middle completion using default model
- `Gemini Coder: Request FIM completion with...` - Get fill-in-the-middle completion with model selection
- `Gemini Coder: Copy FIM Completion Prompt to Clipboard` - Copy FIM prompt with context
- `Gemini Coder: Open Web Chat with FIM Completion Prompt` - Open web chat with FIM prompt

#### Code Refactoring

- `Gemini Coder: Apply Changes to this File` - Apply changes suggested by AI using clipboard content
- `Gemini Coder: Refactor this File with Instruction` - Apply changes based on specific refactoring instruction
- `Gemini Coder: Copy Apply Changes Prompt to Clipboard` - Copy apply changes prompt
- `Gemini Coder: Copy Refactoring Prompt to Clipboard` - Copy refactoring instruction prompt
- `Gemini Coder: Open Web Chat with Apply Changes Prompt` - Open web chat with refactoring prompt
- `Gemini Coder: Open Web Chat with Refactoring Instruction` - Open web chat with specific refactoring instruction

#### Chat Interactions

- `Gemini Coder: Open Web Chat with instruction...` - Compose custom prompt with context
- `Gemini Coder: Compose Chat Prompt to Clipboard` - Create chat prompt with context/prefix/suffix

#### Context Management

- `Gemini Coder: Copy Context` - Copy selected files as XML context
- `Gemini Coder: Clear all checks` - Clear all file selections
- `Gemini Coder: Change Default Model` - Change default AI model for completions
- `Gemini Coder: Change Default Refactoring Model` - Change default AI model for refactoring (apply changes and refactor with instruction commands)

## Set up custom providers

The extension supports any OpenAI API compatible providers for FIM completions and applying changes to files.

```json
  "geminiCoder.providers": [
    {
      "name": "DeepSeek",
      "endpointUrl": "https://api.deepseek.com/v1/chat/completions",
      "bearerToken": "[API KEY]",
      "model": "deepseek-chat",
      "temperature": 0,
      "instruction": ""
    },
    {
      "name": "Mistral Large Latest",
      "endpointUrl": "https://api.mistral.ai/v1/chat/completions",
      "bearerToken": "[API KEY]",
      "model": "mistral-large-latest",
      "temperature": 0,
      "instruction": ""
    },
  ],
```

## License

MIT

This is not an official Google product.

## Author

[Robert Piosik](https://buymeacoffee.com/robertpiosik)
