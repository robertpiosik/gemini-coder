import { Presets } from './Presets'

export default {
  component: Presets
}

const presets: Presets.Preset[] = [
  {
    name: 'Gemini with Flash 2.0',
    chatbot: 'Gemini',
    temperature: 0.5,
    prompt_prefix: 'Please help me with:',
    prompt_suffix: 'Be concise and accurate',
    system_instructions: 'You are a helpful assistant'
  },
  {
    name: 'Code review with ChatGPT',
    chatbot: 'ChatGPT',
    prompt_prefix: 'Review this code:',
    system_instructions: 'Focus on code quality and best practices'
  }
]

export const Multiple = () => {
  return (
    <Presets
      presets={presets}
      on_preset_click={(name) => console.log('on_preset_click', name)}
      disabled={false}
      selected_presets={[]}
      on_selected_presets_change={(names) => console.log('on_selected_presets_change', names)}
      on_edit_presets={() => console.log('on_edit_presets')}
      expanded_presets={[]}
      on_expanded_presets_change={(indices) => console.log('on_expanded_presets_change', indices)}
      is_fim_mode={false}
    />
  )
}

export const Empty = () => {
  return (
    <Presets
      presets={[]}
      on_preset_click={(name) => console.log('on_preset_click', name)}
      disabled={false}
      selected_presets={[]}
      on_selected_presets_change={(names) => console.log('on_selected_presets_change', names)}
      on_edit_presets={() => console.log('on_edit_presets')}
      expanded_presets={[]}
      on_expanded_presets_change={(indices) => console.log('on_expanded_presets_change', indices)}
      is_fim_mode={false}
    />
  )
}
