import browser from 'webextension-polyfill'
import { HtmlParser } from '../utils/html-parser'

const get_favicon_url = (html: string) => {
  const regex =
    /<link[^>]*rel=["'](icon|shortcut icon|apple-touch-icon)["'][^>]*href=["']([^"']+)["']/gi
  const matches = [...html.matchAll(regex)]
  const favicon_rels = ['icon', 'shortcut icon', 'apple-touch-icon']

  for (let rel of favicon_rels) {
    for (let match of matches) {
      if (match[1] == rel) {
        return match[2]
      }
    }
  }

  return '/favicon.ico'
}

const get_favicon_base64 = async (favicon_url: string): Promise<string> => {
  try {
    // Ensure favicon URL is absolute
    const absoluteUrl = new URL(favicon_url, document.location.href).href

    // Fetch the favicon
    const response = await fetch(absoluteUrl)
    const blob = await response.blob()

    // Convert blob to base64
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64data = reader.result as string
        resolve(base64data)
      }
      reader.readAsDataURL(blob)
    })
  } catch (error) {
    console.error('Error fetching favicon:', error)
    return ''
  }
}

browser.runtime.onMessage.addListener((message: any, _, __): any => {
  if (message && message.action == 'get-parsed-html') {
    ;(async () => {
      const html = document.documentElement.outerHTML
      const result = await HtmlParser.parse({
        html,
        url: document.location.href
      })

      // Get and encode favicon
      const favicon_url = get_favicon_url(html)
      const favicon_base64 = await get_favicon_base64(favicon_url)

      browser.runtime.sendMessage({
        action: 'parsed-html',
        parsed_html: result || null,
        favicon: favicon_base64
      })
    })()
  }
  return false
})
