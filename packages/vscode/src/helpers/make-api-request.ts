import * as vscode from 'vscode'
import axios, { AxiosResponse } from 'axios'
import { Provider } from '../types/provider'

type StreamCallback = (chunk: string) => void

const DATA_PREFIX = 'data: '
const DONE_TOKEN = '[DONE]'
const AUTHORIZATION_HEADER = 'Authorization'
const BEARER_PREFIX = 'Bearer '
const CONTENT_TYPE_HEADER = 'Content-Type'
const APPLICATION_JSON = 'application/json'

async function process_stream_chunk(
  chunk: Buffer,
  buffer: string,
  accumulated_content: string,
  last_log_time: number,
  provider_name: string,
  verbose: boolean,
  on_chunk?: StreamCallback
): Promise<{
  updated_buffer: string
  updated_accumulated_content: string
  updated_last_log_time: number
}> {
  let updated_buffer = buffer
  let updated_accumulated_content = accumulated_content
  let updated_last_log_time = last_log_time

  try {
    updated_buffer += chunk.toString()
    const lines = updated_buffer.split('\n')
    updated_buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed_line = line.trim()
      if (!trimmed_line || trimmed_line === DONE_TOKEN) continue

      if (trimmed_line.startsWith(DATA_PREFIX)) {
        try {
          const json_string = trimmed_line.slice(DATA_PREFIX.length).trim()
          if (!json_string || json_string === DONE_TOKEN) continue

          const json_data = JSON.parse(json_string)
          if (json_data.choices?.[0]?.delta?.content) {
            const new_content = json_data.choices[0].delta.content
            updated_accumulated_content += new_content

            if (on_chunk) {
              on_chunk(new_content)
            }

            const current_time = Date.now()
            if (verbose && current_time - updated_last_log_time >= 1000) {
              console.log(
                `[Gemini Coder] ${provider_name} Streaming tokens:`,
                updated_accumulated_content
              )
              updated_last_log_time = current_time
            }
          }
        } catch (parse_error) {
          console.warn('Failed to parse JSON chunk:', trimmed_line, parse_error)
        }
      }
    }
  } catch (error) {
    console.error('Error processing stream chunk:', error)
  }

  return {
    updated_buffer,
    updated_accumulated_content,
    updated_last_log_time
  }
}

export async function make_api_request(
  provider: Provider,
  body: any,
  cancellation_token: any,
  on_chunk?: StreamCallback
): Promise<string | null> {
  try {
    const request_body = { ...body, stream: true }

    let accumulated_content = ''
    let last_log_time = Date.now()
    let buffer = ''

    const config = vscode.workspace.getConfiguration()
    const verbose = config.get<boolean>('geminiCoder.verbose', false)

    const response: AxiosResponse<NodeJS.ReadableStream> = await axios.post(
      provider.endpointUrl,
      request_body,
      {
        headers: {
          [AUTHORIZATION_HEADER]: `${BEARER_PREFIX}${provider.bearerToken}`,
          [CONTENT_TYPE_HEADER]: APPLICATION_JSON
        },
        cancelToken: cancellation_token,
        responseType: 'stream'
      }
    )

    return new Promise((resolve, reject) => {
      response.data.on('data', async (chunk: Buffer) => {
        const processing_result = await process_stream_chunk(
          chunk,
          buffer,
          accumulated_content,
          last_log_time,
          provider.name,
          verbose,
          on_chunk
        )
        buffer = processing_result.updated_buffer
        accumulated_content = processing_result.updated_accumulated_content
        last_log_time = processing_result.updated_last_log_time
      })

      response.data.on('end', () => {
        if (buffer.trim()) {
          try {
            const trimmed_line = buffer.trim()
            if (trimmed_line.startsWith(DATA_PREFIX)) {
              const json_string = trimmed_line.slice(DATA_PREFIX.length).trim()
              if (json_string && json_string !== DONE_TOKEN) {
                const json_data = JSON.parse(json_string)
                if (json_data.choices?.[0]?.delta?.content) {
                  accumulated_content += json_data.choices[0].delta.content
                }
              }
            }
          } catch (error) {
            console.warn('Failed to parse final buffer:', error)
          }
        }

        let content = accumulated_content.trim()

        const regex = /^```(\w+)?\n([\s\S]*?)\n```$/
        const match = content.match(regex)
        if (match) {
          content = match[2]
        }

        if (verbose) {
          console.log('[Gemini Coder] Combined code received:', content)
        }

        resolve(content)
      })

      response.data.on('error', (error: Error) => {
        console.error('Stream error:', error)
        reject(error)
      })
    })
  } catch (error) {
    if (axios.isCancel(error)) {
      console.log('Request canceled:', error.message)
      return null
    } else if (axios.isAxiosError(error) && error.response?.status == 429) {
      return 'rate_limit'
    } else {
      console.error('API request failed:', error)
      vscode.window.showErrorMessage(
        `Failed to send request to ${provider.name}. Check console for details.`
      )
      return null
    }
  }
}
