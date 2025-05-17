type Providers = {
  [name: string]: {
    base_url: string
  }
}

export const PROVIDERS = {
  Gemini: {
    base_url: 'https://generativelanguage.googleapis.com/v1beta/openai'
  },
  OpenRouter: {
    base_url: 'https://openrouter.ai/api/v1'
  },
  Chutes: {
    base_url: 'https://llm.chutes.ai/v1'
  }
} satisfies Providers
