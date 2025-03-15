import { ChatInput } from './ChatInput'

export default {
  component: ChatInput
}

// Basic usage with empty input
export const Empty = () => (
  <ChatInput
    value=""
    on_change={(value) => console.log('Changed:', value)}
    on_submit={() => console.log('Submitted')}
    on_copy={() => console.log('Copied')}
    is_connected={true}
    is_fim_mode={false}
    on_fim_mode_click={() => console.log('FIM Mode Clicked')}
    has_active_editor={false}
  />
)

// Input with some text
export const WithText = () => (
  <ChatInput
    value="Hello, this is a sample message"
    on_change={(value) => console.log('Changed:', value)}
    on_submit={() => console.log('Submitted')}
    on_copy={() => console.log('Copied')}
    is_connected={true}
    is_fim_mode={false}
    on_fim_mode_click={() => console.log('FIM Mode Clicked')}
    has_active_editor={false}
  />
)

// Disabled submit button
export const DisabledSubmit = () => (
  <ChatInput
    value="Cannot submit this message"
    on_change={(value) => console.log('Changed:', value)}
    on_submit={() => console.log('Submitted')}
    on_copy={() => console.log('Copied')}
    is_connected={false}
    submit_disabled_title="Cannot submit at this time"
    is_fim_mode={false}
    on_fim_mode_click={() => console.log('FIM Mode Clicked')}
    has_active_editor={false}
  />
)

// Multiline text
export const MultilineText = () => (
  <ChatInput
    value="This is a message\nwith multiple\nlines of text"
    on_change={(value) => console.log('Changed:', value)}
    on_submit={() => console.log('Submitted')}
    on_copy={() => console.log('Copied')}
    is_connected={true}
    is_fim_mode={false}
    on_fim_mode_click={() => console.log('FIM Mode Clicked')}
    has_active_editor={false}
  />
)

// Long text that should trigger scrolling
export const LongText = () => (
  <ChatInput
    value="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
    on_change={(value) => console.log('Changed:', value)}
    on_submit={() => console.log('Submitted')}
    on_copy={() => console.log('Copied')}
    is_connected={true}
    is_fim_mode={false}
    on_fim_mode_click={() => console.log('FIM Mode Clicked')}
    has_active_editor={false}
  />
)
