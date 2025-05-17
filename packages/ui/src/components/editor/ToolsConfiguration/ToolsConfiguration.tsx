import styles from './ToolsConfiguration.module.scss'
import { ConfigurationHeader } from '../ConfigurationHeader'
import { Button } from '../Button'

type Props = {
  on_setup_code_completions_click: () => void
  on_setup_file_refactoring_click: () => void
  on_setup_commit_messages_click: () => void
}

export const ToolsConfiguration: React.FC<Props> = (props) => {
  const render_api_tool_settings = (params: {
    title: string
    description: string
    on_setup_click: () => void
    button_label: string
  }) => (
    <>
      <ConfigurationHeader
        top_line="API TOOL"
        bottom_line={params.title}
        description={params.description}
      />
      <Button on_click={params.on_setup_click}>{params.button_label}</Button>
    </>
  )

  return (
    <div className={styles.form}>
      {render_api_tool_settings({
        title: 'Code Completions',
        description:
          'Use any model for accurate code completions. The tool attaches selected context in each request.',
        on_setup_click: props.on_setup_code_completions_click,
        button_label: 'Setup Code Completions API Tool'
      })}
      {render_api_tool_settings({
        title: 'File Refactoring',
        description:
          'Modify the active file based on natural language instructions and integrate chat responses of "truncated" edit format.',
        on_setup_click: props.on_setup_file_refactoring_click,
        button_label: 'Setup File Refactoring API Tool'
      })}
      {render_api_tool_settings({
        title: 'Commit Messages',
        description:
          'Generate meaningful commit messages based on diffs and fully attached affected files.',
        on_setup_click: props.on_setup_commit_messages_click,
        button_label: 'Setup Commit Messages API Tool'
      })}
    </div>
  )
}
