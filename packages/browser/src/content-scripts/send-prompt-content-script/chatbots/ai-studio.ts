import { Chatbot } from '../types/chatbot'
import { Message } from '@/types/messages'
import { CHATBOTS } from '@shared/constants/chatbots'
import browser from 'webextension-polyfill'
import {
  apply_chat_response_button_style,
  set_button_disabled_state
} from '../utils/apply-response-styles'
import { is_eligible_code_block } from '../utils/is-eligible-code-block'
import { show_response_ready_notification } from '../utils/show-response-ready-notification'
import {
  apply_response_button_text,
  apply_response_button_title
} from '../constants/copy'

export const ai_studio: Chatbot = {
  wait_until_ready: async () => {
    await new Promise((resolve) => {
      const check_for_element = () => {
        if (document.querySelector('.title-container')) {
          resolve(null)
        } else {
          setTimeout(check_for_element, 100)
        }
      }
      check_for_element()
    })
    await new Promise((resolve) => {
      setTimeout(() => {
        resolve(true)
      }, 500)
    })
  },
  set_model: async (model: string) => {
    const model_selector = (document.querySelector(
      'ms-model-selector-two-column mat-form-field > div'
    ) ||
      document.querySelector(
        'ms-model-selector-collapsible mat-form-field > div'
      )) as HTMLElement
    model_selector.click()
    await new Promise((r) => requestAnimationFrame(r))
    const model_options = Array.from(document.querySelectorAll('mat-option'))
    for (const option of model_options) {
      const model_name_element = option.querySelector(
        'ms-model-option > div:last-child'
      ) as HTMLElement
      if (model_name_element?.textContent?.trim() == model) {
        ;(option as HTMLElement).click()
        break
      }
    }
    await new Promise((r) => requestAnimationFrame(r))
  },
  enter_system_instructions: async (system_instructions: string) => {
    const assignment_button = Array.from(
      document.querySelectorAll('ms-toolbar button')
    ).find(
      (button) => button.textContent?.trim() == 'assignment'
    ) as HTMLButtonElement
    assignment_button.click()
    await new Promise((r) => requestAnimationFrame(r))
    const system_instructions_selector =
      'textarea[aria-label="System instructions"]'
    const system_instructions_element = document.querySelector(
      system_instructions_selector
    ) as HTMLTextAreaElement
    system_instructions_element.value = system_instructions
    system_instructions_element.dispatchEvent(
      new Event('input', { bubbles: true })
    )
    system_instructions_element.dispatchEvent(
      new Event('change', { bubbles: true })
    )
    assignment_button.click()
    await new Promise((r) => requestAnimationFrame(r))
  },
  set_options: async (options: string[]) => {
    const supported_options = CHATBOTS['AI Studio'].supported_options
    for (const option of options) {
      if (
        option == 'disable-thinking' &&
        supported_options['disable-thinking']
      ) {
        const thinking_toggle = document.querySelector(
          'mat-slide-toggle[data-test-toggle="enable-thinking"] button'
        ) as HTMLElement
        thinking_toggle.click()
      } else if (option == 'hide-panel' && supported_options['hide-panel']) {
        const panel = document.querySelector(
          'ms-right-side-panel'
        ) as HTMLElement
        const button = Array.from(panel.querySelectorAll('button')).find(
          (button) => button.textContent?.trim() == 'tune'
        ) as HTMLButtonElement
        button.click()
      }
    }
  },
  set_temperature: async (temperature: number) => {
    if (window.innerWidth <= 768) {
      const tune_button = Array.from(
        document.querySelectorAll('prompt-header button')
      ).find(
        (button) => button.textContent?.trim() == 'tune'
      ) as HTMLButtonElement
      tune_button.click()
      await new Promise((r) => requestAnimationFrame(r))
    }
    const temperature_element = document.querySelector(
      'ms-prompt-run-settings div[data-test-id="temperatureSliderContainer"] input[type=number]'
    ) as HTMLInputElement
    temperature_element.value = temperature.toString()
    temperature_element.dispatchEvent(new Event('change', { bubbles: true }))
    if (window.innerWidth <= 768) {
      const close_button = Array.from(
        document.querySelectorAll('ms-run-settings button')
      ).find(
        (button) => button.textContent?.trim() == 'close'
      ) as HTMLButtonElement
      close_button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    }
  },
  set_thinking_budget: async (thinking_budget: number) => {
    if (window.innerWidth <= 768) {
      const tune_button = Array.from(
        document.querySelectorAll('prompt-header button')
      ).find(
        (button) => button.textContent?.trim() == 'tune'
      ) as HTMLButtonElement
      tune_button.click()
      await new Promise((r) => requestAnimationFrame(r))
    }
    const manual_budget_toggle = document.querySelector(
      'mat-slide-toggle[data-test-toggle="manual-budget"] button'
    ) as HTMLElement
    manual_budget_toggle.click()
    await new Promise((r) => requestAnimationFrame(r))
    const budget_input = document.querySelector(
      'div[data-test-id="user-setting-budget-animation-wrapper"] input'
    ) as HTMLInputElement
    budget_input.value = thinking_budget.toString()
    budget_input.dispatchEvent(new Event('input', { bubbles: true }))
    budget_input.dispatchEvent(new Event('change', { bubbles: true }))
    if (window.innerWidth <= 768) {
      const close_button = Array.from(
        document.querySelectorAll('ms-run-settings button')
      ).find(
        (button) => button.textContent?.trim() == 'close'
      ) as HTMLButtonElement
      close_button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    }
  },
  set_top_p: async (top_p: number) => {
    if (window.innerWidth <= 768) {
      const tune_button = Array.from(
        document.querySelectorAll('prompt-header button')
      ).find(
        (button) => button.textContent?.trim() == 'tune'
      ) as HTMLButtonElement
      tune_button.click()
      await new Promise((r) => requestAnimationFrame(r))
    }
    const top_p_element = document.querySelector(
      'ms-prompt-run-settings div[mattooltip="Probability threshold for top-p sampling"] input[type=number]'
    ) as HTMLInputElement
    top_p_element.value = top_p.toString()
    top_p_element.dispatchEvent(new Event('change', { bubbles: true }))
    if (window.innerWidth <= 768) {
      const close_button = Array.from(
        document.querySelectorAll('ms-run-settings button')
      ).find(
        (button) => button.textContent?.trim() == 'close'
      ) as HTMLButtonElement
      close_button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    }
  },
  inject_apply_response_button: (client_id: number) => {
    const add_buttons = (params: { footer: Element }) => {
      // Check if buttons already exist by text content to avoid duplicates
      const existing_apply_response_button = Array.from(
        params.footer.querySelectorAll('button')
      ).find((btn) => btn.textContent == apply_response_button_text)

      if (existing_apply_response_button) return

      // Find the parent chat-turn-container
      const chat_turn = params.footer.closest('ms-chat-turn') as HTMLElement

      if (!chat_turn) {
        console.error(
          'Chat turn container not found for footer:',
          params.footer
        )
        return
      }

      const first_line_comments_of_code_blocks =
        chat_turn.querySelectorAll('ms-code-block code')
      let has_eligible_block = false
      for (const code_block of Array.from(first_line_comments_of_code_blocks)) {
        const first_line_text = code_block?.textContent?.split('\n')[0]
        if (first_line_text && is_eligible_code_block(first_line_text)) {
          has_eligible_block = true
          break
        }
      }
      if (!has_eligible_block) return

      const create_apply_response_button = () => {
        const apply_response_button = document.createElement('button')
        apply_response_button.textContent = apply_response_button_text
        apply_response_button.title = apply_response_button_title
        apply_chat_response_button_style(apply_response_button)

        apply_response_button.addEventListener('click', async () => {
          set_button_disabled_state(apply_response_button)
          const chat_turn_container = apply_response_button.closest(
            '.chat-turn-container'
          )!
          const options = chat_turn_container.querySelector(
            'ms-chat-turn-options > div > button'
          ) as HTMLElement
          options.click()
          const markdown_copy_button = Array.from(
            document.querySelectorAll('button')
          ).find((button) =>
            button.textContent?.includes('markdown_copy')
          ) as HTMLElement
          markdown_copy_button.click()
          await new Promise((resolve) => setTimeout(resolve, 500))
          browser.runtime.sendMessage<Message>({
            action: 'apply-chat-response',
            client_id
          })
        })

        params.footer.insertBefore(
          apply_response_button,
          params.footer.children[2]
        )

        apply_response_button.focus()
      }

      create_apply_response_button()
    }

    // AI Studio is quite sluggish with showing already generated tokens,
    // therefore we handle waiting for finished response differently than
    // in other chatbots.
    let debounce_timer: NodeJS.Timeout
    const observer = new MutationObserver(() => {
      clearTimeout(debounce_timer)
      debounce_timer = setTimeout(() => {
        const all_footers = document.querySelectorAll(
          'ms-chat-turn .turn-footer'
        )
        all_footers.forEach((footer) => {
          if (
            footer.querySelector('mat-icon')?.textContent?.trim() == 'thumb_up'
          ) {
            show_response_ready_notification({ chatbot_name: 'AI Studio' })
            add_buttons({
              footer
            })
          }
        })
      }, 100)
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    })
  }
}
