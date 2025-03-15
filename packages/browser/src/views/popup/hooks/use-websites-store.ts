import { UpdateSavedWebsitesMessage } from '@/types/messages'
import localforage from 'localforage'
import browser from 'webextension-polyfill'

export type StoredWebsite = {
  url: string
  title: string
  content: string
  favicon?: string // Base64 encoded favicon
  order?: number
}

export type Website = {
  url: string
  title: string
  content: string
  favicon?: string
}

// Initialize localforage instance for website data
const STORE_NAME = 'websites'
export const websites_store = localforage.createInstance({
  name: 'gemini-coder-connector',
  storeName: STORE_NAME
})

export const use_websites_store = () => {
  // Notify background script about website changes
  const notify_website_changes = async () => {
    try {
      const websites = await get_all_websites()
      // Convert StoredWebsite[] to Website[] for sending
      const websites_to_send: Website[] = websites.map((site) => ({
        url: site.url,
        title: site.title,
        content: site.content,
        favicon: site.favicon
      }))

      const message: UpdateSavedWebsitesMessage = {
        action: 'update-saved-websites',
        websites: websites_to_send
      }

      // Send message to background script
      await browser.runtime.sendMessage(message)
    } catch (error) {
      console.error('Error notifying website changes:', error)
    }
  }

  const store_website = async (website: Website) => {
    try {
      // Get all existing websites to determine the next order value
      const websites = await get_all_websites()

      // Find the highest order number
      const max_order =
        websites.length > 0
          ? Math.max(...websites.map((site) => site.order || 0))
          : -1

      const stored_website: StoredWebsite = {
        url: website.url,
        title: website.title,
        content: website.content,
        favicon: website.favicon,
        order: max_order + 1 // Assign the next order number
      }

      await websites_store.setItem(website.url, stored_website)

      // Notify background script about the change
      await notify_website_changes()
      return true
    } catch (error) {
      console.error('Error storing website:', error)
      return false
    }
  }

  const get_website = async (url: string): Promise<StoredWebsite | null> => {
    try {
      const stored = await websites_store.getItem<StoredWebsite>(url)
      // Handle legacy websites that don't have order property
      if (stored && stored.order === undefined) {
        stored.order = 0
      }
      return stored
    } catch (error) {
      console.error('Error getting website:', error)
      return null
    }
  }

  const get_all_websites = async (): Promise<StoredWebsite[]> => {
    const websites: StoredWebsite[] = []
    try {
      await websites_store.iterate<StoredWebsite, void>((value) => {
        // Handle legacy websites that might have is_enabled property
        const { is_enabled, ...rest } = value as any

        // Handle legacy websites that don't have order property
        if (rest.order === undefined) {
          rest.order = 0
        }
        websites.push(rest)
      })

      // Sort websites by order value to ensure consistent display order
      return websites.sort((a, b) => (a.order || 0) - (b.order || 0))
    } catch (error) {
      console.error('Error getting all websites:', error)
      return []
    }
  }

  const delete_website = async (url: string): Promise<boolean> => {
    try {
      await websites_store.removeItem(url)

      // Notify background script about the change
      await notify_website_changes()
      return true
    } catch (error) {
      console.error('Error deleting website:', error)
      return false
    }
  }

  // New function to update the order of websites
  const update_websites_order = async (
    orderedUrls: string[]
  ): Promise<boolean> => {
    try {
      // Update each website with its new order
      for (let i = 0; i < orderedUrls.length; i++) {
        const website = await get_website(orderedUrls[i])
        if (website) {
          website.order = i
          await websites_store.setItem(orderedUrls[i], website)
        }
      }

      // Notify background script about the change
      await notify_website_changes()
      return true
    } catch (error) {
      console.error('Error updating websites order:', error)
      return false
    }
  }

  return {
    store_website,
    get_website,
    get_all_websites,
    delete_website,
    update_websites_order
  }
}
