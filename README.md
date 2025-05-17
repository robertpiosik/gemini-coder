<div >
  <img src="https://raw.githubusercontent.com/robertpiosik/CodeWebChat/refs/heads/master/packages/vscode/media/logo.png" alt="logo" width="60">
  <br/>
  <h1>Code Web Chat (CWC)</h1>
  <h4 style="line-height: 1.8">
  👉 Copy selected folders and files for web chats or initialize them hands-free!
  <br/>
  👉 Apply chat responses with truncated, whole or diff markdown code blocks
  <br/>
  👉 Use the same context for quality code completions and file refactorings
  <br/>
  👉 Generate meaningful commit messages
  </h4>

<a href="https://marketplace.visualstudio.com/items?itemName=robertpiosik.gemini-coder"><img src="https://img.shields.io/badge/Download-VS_Code_Marketplace-blue" alt="Download from Visual Studio Code Marketplace"></a>
<a href="https://x.com/CodeWebChat"><img src="https://img.shields.io/badge/Follow-@CodeWebChat-black?logo=x" alt="X"></a>
<a href="https://www.reddit.com/r/CodeWebChat"><img src="https://img.shields.io/badge/Join_subreddit-r%2FCodeWebChat-orange?logo=reddit&logoColor=white" alt="Join subreddit r/CodeWebChat on Reddit"></a>
<br/>

</div>

<a href="https://codeweb.chat/">Documentation</a>

Non-agentic 100% free & open source coding tool for AI-assisted programming.

Guiding Principles:

- initialize all popular chatbots
- don't overengineer AI-assistance
- stay free and do not track usage
- be robust and lightweight (~1 MB)

CWC is for you if:

- you're a craftsman working on a large codebase
- you're a student or hobbyist on a budget
- coding agents are too autonomous for your liking
- you value privacy and full control over your data
- you love open source software! 🫶

<br/>

<img src="https://github.com/robertpiosik/CodeWebChat/raw/HEAD/packages/shared/src/media/walkthrough.gif" alt="Walkthrough" />

<br/>

## You own the context

Other tools try to "guess" what pieces of the codebase matter for the given task, often struggling to get it right. They workaround this problem by overloading context with excessive information, hurting model's performance and your wallet.

CWC works differently:

- **You select** which folders and files are relevant to the task
- **You decide** what examples of coding conventions will work best
- **You know** exactly how much tokens you have in the context

The result? Unmatched in cost, speed and accuracy AI assistance.

> Too many tokens fighting for attention may _decrease_ performance due to being too "distracting", diffusing attention too broadly and decreasing a signal to noise ratio in the features. ~Andrej Karpathy

## Web chats

As everyone have their own favorite chatbot, each with unique features, feel and associated costs (with some being completely free!) CWC's core feature is prompt preparation (special context formatting using XML tags and instructions placement) for copy & paste and their hands-free initialization.

**The feature has two modes:**

- General - context and your instructions
- Code Completions - context, open editor with marked cursor position

Additional texts for model's guidance are fully adjustable in settings.

**_Apply Chat Response_** is a smart tool that automatically integrates chat responses with the codebase, either refactoring with API ("Truncated" edit format), replacing original files in place ("Whole" edit format) or patching with diffs ("Diff" edit format).

**Supported chatbots: (alphabetically)**

- AI Studio
- ChatGPT
- Claude
- DeepSeek
- Gemini
- Grok
- HuggingChat
- Mistral
- Open WebUI (self-hosted)
- OpenRouter Chat
- Qwen
- Yuanbao

The Connector extension is available in [Chrome Web Store](https://chromewebstore.google.com/detail/gemini-coder-connector/ljookipcanaglfaocjbgdicfbdhhjffp) and [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/gemini-coder-connector/).

> <small>**Legal Disclaimer:** After chat initialization, the extension does not read the incoming message. The injected _Apply response_ button is not a means of automatic output extraction, it's an alias for the original _copy to clipboard_ button.</small>

### Practice single-turns

Chat conversations are only a construct of product interfaces, they hurt the quality of responses from the model and once your context is "poisoned" it will not recover. Whenever you're not satisfied with a reponse, **the best practice is to alawys refine your initial instructions and re-initialize**.

## 🧰 Tools

Support your day-to-day work with all must-have AI features.

**Bring your own API keys for:**

- Gemini API
- OpenRouter

<small>
API keys are stored locally on your computer and all requests are sent directly to the provider.
</small>

#### 🛠️ Code completions

Use any model for accurate code completions. The tool attaches selected context in each request.

#### 🛠️ File refactoring

Modify the active file based on natural language instructions. The tool attaches selected context in each request.

#### 🛠️ Apply chat response

Automatically integrate chat responses with your codebase. The tool detects whether the clipboard contains complete files (replaces them directly), diffs or truncated files with ellipsis commments, e.g. "// ..." (applies them intelligently).

#### 🛠️ Commit messages

Generate meaningful commit messages based on contents of affected files and diffs of changes.

## Quick start for chat

1. Open the new Code Web Chat view from the activity bar (sparkles icon).
2. Select folders and files to include in the context.
3. Enter instructions and copy generated prompt.
4. (optional) Install [browser integration](https://gemini-coder.netlify.app/docs/installation/web-browser-integration) for hands-free initializations.

## Quick start for code completions

1. Open the new Code Web Chat view from the activity bar (sparkles icon).
2. Select folders and files to include in the context.
3. Place caret where you want code completion to appear.
4. Use Command Palette (Ctrl/Cmd + Shift + P) and type "Code Completion".
5. Bind the command to a keyboard shortcut by opening Keyboard Shortcuts (Ctrl/Cmd+K Ctrl/Cmd+S), searching for `Code Web Chat: Code Completion`, clicking the + icon, and pressing your preferred key combination (e.g. Ctrl/Cmd+I).

## Commands

#### Code completions

- `Code Web Chat: Code Completion` - Get code completion.
- `Code Web Chat: Code Completion with Suggestions` - Get code completion that follows given suggestions.
- `Code Web Chat: Code Completion to Clipboard` - Copy code completion prompt to clipboard.
- `Code Web Chat: Code Completion with Suggestions to Clipboard` - Copy code completion with suggestions prompt to clipboard.
- `Code Web Chat: Code Completion in Chat` - Send code completion prompt to web chat using default preset.
- `Code Web Chat: Code Completion in Chat with...` - Send code completion prompt to web chat with preset selection.

#### Refactoring

- `Code Web Chat: Refactor` - Refactor active editor.
- `Code Web Chat: Refactor to Clipboard` - Copy refactoring prompt to clipboard.

#### Applying chat responses

- `Code Web Chat: Apply Chat Response` - Apply changes suggested by AI using clipboard content.
- `Code Web Chat: Apply Chat Response (Fast replace)` - Apply changes suggested by AI using clipboard content (Fast replace).
- `Code Web Chat: Apply Chat Response (Intelligent update)` - Apply changes suggested by AI using clipboard content (Intelligent update).
- `Code Web Chat: Revert Last Applied Changes` - Revert the last applied changes.

#### Chat

- `Code Web Chat: Web Chat` - Open web chat with default preset.
- `Code Web Chat: Web Chat with...` - Open web chat with preset selection.
- `Code Web Chat: Chat to Clipboard` - Enter instructions and copy to clipboard.

#### Context

- `Code Web Chat: Copy Context` - Copy selected folders/files and websites to clipboard.

## Contributing

All contributions are welcome. Feel free to submit pull requests or create issues and discussions.

## Donations

If you find CWC helpful, please consider a [donation](https://buymeacoffee.com/robertpiosik). Thank you 🙏

**BTC:** bc1qfzajl0fc4347knr6n5hhuk52ufr4sau04su5te

**LTC**: ltc1qcpmwsj2wm8hp7nw8jjsjuj5r3x9ggur052wkcx

**ETH:** 0x532eA8CA70aBfbA6bfE35e6B3b7b301b175Cf86D

**XMR:** 84whVjApZJtSeRb2eEbZ1pJ7yuBoGoWHGA4JuiFvdXVBXnaRYyQ3S4kTEuzgKjpxyr3nxn1XHt9yWTRqZ3XGfY35L4yDm6R

## Community

Participate in [discussions](https://github.com/robertpiosik/CodeWebChat/discussions) and join [/r/CodeWebChat](https://www.reddit.com/r/CodeWebChat).

## License

Copyright © 2025-present [Robert Piosik](https://x.com/robertpiosik)
</br>📨 `robertpiosik@gmail.com`
</br>Telegram: `@robertpiosik`
</br>📃 [GPL-3.0 license](https://github.com/robertpiosik/CodeWebChat/blob/master/LICENSE)
