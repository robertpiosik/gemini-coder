export function log(params: {
  function_name?: string
  message: string
  data?: any
}): void {
  const prefix = params.function_name ? `[${params.function_name}] ` : ''
  console.log(`[Gemini Coder]${prefix}${params.message}`, params.data)
}

export function warn(params: {
  function_name?: string
  message: string
  data?: any
}): void {
  const prefix = params.function_name ? `[${params.function_name}] ` : ''
  console.warn(`[Gemini Coder]${prefix}${params.message}`, params.data)
}

export function error(params: {
  function_name?: string
  message: string
  data?: any
}): void {
  const prefix = params.function_name ? `[${params.function_name}] ` : ''
  console.error(`[Gemini Coder]${prefix}${params.message}`, params.data)
}
