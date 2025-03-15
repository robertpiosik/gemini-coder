import DOMPurify from 'dompurify'
import type TurndownService from 'turndown'
import TurndownServiceJoplin from '@joplin/turndown'
import * as turndownPluginGfm from '@joplin/turndown-plugin-gfm'
import { Readability, isProbablyReaderable } from '@mozilla/readability'

export namespace HtmlParser {
  export type Params = {
    url: string
    html: string
  }
  export type ParsedResult = {
    title: string
    content: string
  }

  export const create_turndown_service = (): TurndownService => {
    const turndown_service: TurndownService = new TurndownServiceJoplin({
      codeBlockStyle: 'fenced'
    })
    turndown_service.use(turndownPluginGfm.gfm)
    // Convert code blocks to markdown
    turndown_service.addRule('fencedCodeBlock', {
      filter: (node: any, options: any) => {
        return (
          options.codeBlockStyle == 'fenced' &&
          node.nodeName == 'PRE' &&
          node.querySelector('code')
        )
      },
      replacement: (_: any, node: any, options: any) => {
        const language = (node
          .querySelector('code')
          .className.match(/language-(\S+)/) || [null, ''])[1]

        return (
          '\n\n' +
          options.fence +
          language +
          '\n' +
          node.textContent +
          '\n' +
          options.fence +
          '\n\n'
        )
      }
    })
    // Convert math blocks to markdown
    turndown_service.addRule('multiplemath', {
      filter(node) {
        return (
          node.nodeName == 'SPAN' && node.classList.contains('katex-display')
        ) // Check if it's a display math block that centers equation
      },
      replacement(_, node) {
        // "<annotation>" element holds expression string, right for markdown
        const annotation = node.querySelector('annotation')?.textContent
        if (!annotation) return ''
        return `$$\n${annotation}\n$$`
      }
    })
    turndown_service.addRule('multiplemath', {
      filter(node) {
        return node.nodeName == 'SPAN' && node.classList.contains('katex')
      },
      replacement(_, node) {
        // Check if the node is the only child of its parent paragraph
        // Yes - block, no - inline
        const is_block =
          node.parentNode?.nodeName == 'P' &&
          node.parentNode.childNodes.length == 1
        // "<annotation>" element holds expression string, right for markdown
        const annotation = node.querySelector('annotation')?.textContent
        if (!annotation) return ''
        return is_block ? `$$ ${annotation} $$` : `$${annotation}$`
      }
    })
    turndown_service.addRule('stripElements', {
      filter: ['figure', 'picture', 'sup'],
      replacement: () => ''
    })
    return turndown_service
  }

  export const parse = async (
    params: Params
  ): Promise<ParsedResult | undefined> => {
    const turndown_service = create_turndown_service()

    const titleRegex = /<title>(.*?)<\/title>/
    const match = params.html.match(titleRegex)
    let title_element_text: string = ''
    if (match) {
      title_element_text = match[1]
    }

    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(
        DOMPurify.sanitize(params.html),
        'text/html'
      )
      if (!isProbablyReaderable(doc)) return
      const links = doc.querySelectorAll('a')
      const url = new URL(params.url)
      links.forEach((link) => {
        const href = link.getAttribute('href')
        if (href && href.startsWith('/')) {
          link.setAttribute('href', url.origin + href)
        }
      })
      const article = new Readability(doc, { keepClasses: true }).parse()
      if (article) {
        const title = article.title || title_element_text
        let content = turndown_service.turndown(article.content)
        content = strip_markdown_links(content)
        content = remove_markdown_images(content)

        return {
          title,
          content
        }
      }
    } catch (error) {
      console.error('Error parsing HTML:', error)
      return undefined
    }
  }
}

// Replace "[TEXT](URL)" with "[TEXT]()"
const strip_markdown_links = (text: string) => {
  return text.replace(/\[([^\]]*)\]\(([^)]*)\)/g, (_, text) => `[${text}]()`)
}

const remove_markdown_images = (text: string) => {
  return text.replace(/!\[([^\]]*)\]\(([^)]*)\)/g, '')
}
