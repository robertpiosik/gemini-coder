import styles from './SettingsTab.module.scss'
import { ToolsConfiguration as UiToolsConfiguration } from '@ui/components/editor/ToolsConfiguration'
import { Button } from '@ui/components/editor/Button'
import { WebviewMessage } from '@/view/types/messages'

type Props = {
  vscode: any
  is_visible: boolean
}

export const SettingsTab: React.FC<Props> = (props) => {
  const handle_configure_api_providers_click = () => {
    props.vscode.postMessage({
      command: 'CONFIGURE_API_PROVIDERS'
    } as WebviewMessage)
  }

  const handle_setup_code_completions_click = () => {
    props.vscode.postMessage({
      command: 'SETUP_API_TOOL_CODE_COMPLETIONS'
    } as WebviewMessage)
  }

  const handle_setup_file_refactoring_click = () => {
    props.vscode.postMessage({
      command: 'SETUP_API_TOOL_FILE_REFACTORING'
    } as WebviewMessage)
  }

  const handle_setup_commit_messages_click = () => {
    props.vscode.postMessage({
      command: 'SETUP_API_TOOL_COMMIT_MESSAGES'
    } as WebviewMessage)
  }

  return (
    <div
      className={styles.container}
      style={{ display: !props.is_visible ? 'none' : undefined }}
    >
      <Button on_click={handle_configure_api_providers_click}>
        Configure API Providers
      </Button>
      <UiToolsConfiguration
        on_setup_code_completions_click={handle_setup_code_completions_click}
        on_setup_file_refactoring_click={handle_setup_file_refactoring_click}
        on_setup_commit_messages_click={handle_setup_commit_messages_click}
      />
    </div>
  )
}
