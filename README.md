# Gemini Coder - the 2M context AI coding assistant

All-in-one, universal, free and open-source AI coding assistant with first class support for AI Studio and Gemini API. Granularly pick context and initalize chats in the web browser, hands-free! Use the same context using API with Fill-In-the-Middle (FIM) completions and file refactoring. With the Apply Changes feature integrating AI suggested modifications is a walk in the park!

Supports all Gemini models with your own API key out of the box and all the other OpenAI API compatible providers.

The Connector browser extension supports all major chatbots: AI Studio, Gemini, ChatGPT, Claude, GitHub Copilot Mistral, DeepSeek and more.

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
4.  Type `Gemini Coder: FIM Completion`.
5.  Bind command to a key combination of your choice in `Preferences: Open Keyboard Shortcuts`, e.g., `Ctrl+P` for `Gemini Coder: FIM Completion`.

## Commands

#### FIM Completions

- `Gemini Coder: FIM Completion` - Get fill-in-the-middle completion using default model
- `Gemini Coder: FIM Completion with...` - Get fill-in-the-middle completion with model selection
- `Gemini Coder: FIM Completion to Clipboard` - Copy FIM completion content to clipboard
- `Gemini Coder: Change Default FIM Model` - Change default AI model for FIM completions

#### Refactoring

- `Gemini Coder: Refactor this File` - Apply changes based on refactoring instruction
- `Gemini Coder: Refactor this File with...` - Refactor with model selection
- `Gemini Coder: Refactor to Clipboard` - Copy refactoring content to clipboard
- `Gemini Coder: Change Default Refactoring Model` - Change default AI model for refactoring

#### Applying Changes

- `Gemini Coder: Apply Changes to this File` - Apply changes suggested by AI using clipboard content
- `Gemini Coder: Apply Changes to this File with...` - Apply changes with model selection
- `Gemini Coder: Apply Changes to Clipboard` - Copy apply changes content to clipboard
- `Gemini Coder: Change Default Apply Changes Model` - Change default AI model for applying changes

#### Chat Interactions

- `Gemini Coder: Web Chat` - Open web chat with context
- `Gemini Coder: Chat to Clipboard` - Create chat content with context to clipboard

#### Context Management

- `Gemini Coder: Copy Context` - Copy selected files as XML context

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

Copyright (c) 2025, [Robert Piosik](https://buymeacoffee.com/robertpiosik). (MIT License)
