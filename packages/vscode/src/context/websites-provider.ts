import { Website } from '@shared/types/websocket-message'
import * as vscode from 'vscode'

// Custom tree item for websites
export class WebsiteItem extends vscode.TreeItem {
  public readonly token_count: number

  constructor(
    public readonly title: string,
    public readonly url: string,
    public readonly content: string,
    public readonly favicon?: string,
    public checkboxState: vscode.TreeItemCheckboxState = vscode
      .TreeItemCheckboxState.Unchecked
  ) {
    super(title, vscode.TreeItemCollapsibleState.None)

    // Calculate token count for this website (simple approximation)
    this.token_count = Math.floor(content.length / 4)
    const formatted_token_count =
      this.token_count >= 1000
        ? `${Math.floor(this.token_count / 1000)}k`
        : `${this.token_count}`

    // Set tooltip to show URL on hover
    this.tooltip = `${url} (${formatted_token_count} tokens)`

    this.description = formatted_token_count

    // Set icon based on favicon if available, otherwise use generic icon
    if (favicon) {
      // Create a proper Uri from the data URI
      this.iconPath = vscode.Uri.parse(favicon)
    } else {
      // Use generic web icon
      this.iconPath = new vscode.ThemeIcon('globe')
    }

    // Add command to preview website content
    this.command = {
      command: 'geminiCoder.previewWebsite',
      title: 'Preview Website Content',
      arguments: [this]
    }

    this.contextValue = 'website'
  }
}

export class WebsitesProvider
  implements vscode.TreeDataProvider<WebsiteItem>, vscode.Disposable
{
  private _websites: Website[] = []
  private _checked_websites: Map<string, vscode.TreeItemCheckboxState> =
    new Map()
  private _onDidChangeTreeData = new vscode.EventEmitter<
    WebsiteItem | undefined | null | void
  >()
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event

  private _onDidChangeCheckedWebsites = new vscode.EventEmitter<void>()
  readonly onDidChangeCheckedWebsites = this._onDidChangeCheckedWebsites.event

  constructor() {}

  // Update websites from WebSocket message
  update_websites(websites: Website[]): void {
    // Create a set of URLs in the new list of websites
    const new_website_urls = new Set(websites.map((website) => website.url))

    // Remove checkbox states for websites that are no longer in the list
    for (const url of this._checked_websites.keys()) {
      if (!new_website_urls.has(url)) {
        this._checked_websites.delete(url)
      }
    }

    this._websites = websites
    this._onDidChangeTreeData.fire()
    this._onDidChangeCheckedWebsites.fire() // Notify about potential checkbox changes
  }

  // TreeDataProvider implementation
  getTreeItem(element: WebsiteItem): vscode.TreeItem {
    // Get the checkbox state or default to unchecked
    const checkbox_state =
      this._checked_websites.get(element.url) ??
      vscode.TreeItemCheckboxState.Unchecked
    element.checkboxState = checkbox_state
    return element
  }

  getChildren(): Thenable<WebsiteItem[]> {
    return Promise.resolve(
      this._websites.map(
        (website) =>
          new WebsiteItem(
            website.title || website.url,
            website.url,
            website.content,
            website.favicon,
            this._checked_websites.get(website.url) ??
              vscode.TreeItemCheckboxState.Unchecked
          )
      )
    )
  }

  // Get checked websites
  get_checked_websites(): Website[] {
    return this._websites.filter(
      (website) =>
        this._checked_websites.get(website.url) ===
        vscode.TreeItemCheckboxState.Checked
    )
  }

  // Get total token count of checked websites
  get_checked_websites_token_count(): number {
    return this.get_checked_websites()
      .map((website) => Math.floor(website.content.length / 4))
      .reduce((sum, count) => sum + count, 0)
  }

  // Update checkbox state for a website
  async update_check_state(
    item: WebsiteItem,
    state: vscode.TreeItemCheckboxState
  ): Promise<void> {
    this._checked_websites.set(item.url, state)
    this._onDidChangeCheckedWebsites.fire()
    this._onDidChangeTreeData.fire()
  }

  // Dispose of event emitters
  dispose(): void {
    this._onDidChangeTreeData.dispose()
    this._onDidChangeCheckedWebsites.dispose()
  }
}
