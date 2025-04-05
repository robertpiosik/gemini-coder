import styles from './Main.scss'
import { BUILT_IN_PROVIDERS } from '../../constants/built-in-providers'
import { Button } from '@ui/components/Button'
import { Separator } from '@ui/components/Separator'

type Props = {
  providers: any[]
  default_fim_model: string
  default_refactoring_model: string
  default_apply_changes_model: string
  default_commit_message_model: string
  api_key: string
  on_fim_model_change: (model: string) => void
  on_refactoring_model_change: (model: string) => void
  on_apply_changes_model_change: (model: string) => void
  on_commit_message_model_change: (model: string) => void
  on_api_key_change: (apiKey: string) => void
  open_providers_settings: () => void
}

export const Main: React.FC<Props> = (props) => {
  const provider_options = [
    ...BUILT_IN_PROVIDERS.map((provider) => ({
      name: provider.name,
      value: provider.name
    })),
    ...props.providers.map((provider) => ({
      name: provider.name,
      value: provider.name
    }))
  ]

  return (
    <div className={styles.container}>
      <Separator size="small" />

      <div className={styles['form-group']}>
        <div className={styles['form-field']}>
          <label>Gemini API key</label>
          <input
            value={props.api_key}
            onChange={(e) => props.on_api_key_change(e.target.value)}
            placeholder="Enter your API key"
          />
          {!props.api_key && (
            <div className={styles.hint}>
              Create yours in{' '}
              <a href="https://aistudio.google.com/app/apikey">AI Studio</a>.
            </div>
          )}
        </div>
      </div>

      <Separator size="large" />

      <div className={styles.header}>
        Select default model for each feature:
      </div>

      <Separator size="medium" />

      <div className={styles['model-group']}>
        <div className={styles['model-select']}>
          <label>FIM</label>
          <select
            value={props.default_fim_model}
            onChange={(e) => props.on_fim_model_change(e.target.value)}
          >
            {provider_options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles['model-select']}>
          <label>File Refactoring</label>
          <select
            value={props.default_refactoring_model}
            onChange={(e) => props.on_refactoring_model_change(e.target.value)}
          >
            {provider_options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles['model-select']}>
          <label>Apply Changes</label>
          <select
            value={props.default_apply_changes_model}
            onChange={(e) =>
              props.on_apply_changes_model_change(e.target.value)
            }
          >
            {provider_options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles['model-select']}>
          <label>Commit Message</label>
          <select
            value={props.default_commit_message_model}
            onChange={(e) =>
              props.on_commit_message_model_change(e.target.value)
            }
          >
            {provider_options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Separator size="large" />

      <Button on_click={props.open_providers_settings}>
        My Model Providers
      </Button>
    </div>
  )
}
