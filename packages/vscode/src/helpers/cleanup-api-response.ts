/**
 * Cleans up the API response by stripping away code block markers,
 * file markers, leading DOCTYPE tags, and ensuring a trailing newline.
 */
export function cleanup_api_response(params: {
  content: string
  end_with_new_line?: boolean
}): string {
  try {
    let content = params.content
    // If a markdown code block is detected, extract its contents
    const markdown_regex = /```[^\n]*\n([\s\S]*?)(?:```|$)/m
    const markdown_match = params.content.match(markdown_regex)
    if (markdown_match) {
      content = markdown_match[1]
    }

    // Remove any file markers we use in context
    content = content.replace(/<files[^>]*>/g, '')
    content = content.replace(/<\/files>/g, '')
    content = content.replace(/<file[^>]*>/g, '')
    content = content.replace(/<\/file>/g, '')

    // Remove CDATA tags
    content = content.replace('<![CDATA[', '')
    content = content.replace(']]>', '')

    // Remove unexpected DOCTYPE if the content starts with one
    if (content.startsWith('<!DOCTYPE')) {
      content = content.substring(content.indexOf('>') + 1)
    }

    // Trim extra whitespace
    content = content.trim()

    // Add newline only if content contains multiple lines
    if (params.end_with_new_line) {
      content += '\n'
    }

    return content
  } catch (error) {
    console.error('Error cleaning up API response:', error)
    return params.content // Return original content if an error occurs
  }
}
