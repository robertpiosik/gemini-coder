import { SavedWebsites, Website } from './SavedWebsites'

export default {
  component: SavedWebsites
}

const sampleWebsites: Website[] = [
  {
    url: 'https://example.com/1',
    title: 'Example Website 1',
    content: 'This is the content of example website 1.'
  },
  {
    url: 'https://example.com/2',
    title: 'Example Website with a Very Long Title That Should be Truncated',
    content: 'This is the content of example website 2.',
    favicon:
      'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNiAxNiI+PHJlY3Qgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBmaWxsPSIjMDA3NGQ5Ii8+PHRleHQgeD0iOCIgeT0iOCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iIGZpbGw9IndoaXRlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMCI+RTwvdGV4dD48L3N2Zz4='
  },
  {
    url: 'https://example.com/3',
    title: 'Example Website 3',
    content: 'This is the content of example website 3.',
    favicon:
      'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNiAxNiI+PHJlY3Qgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBmaWxsPSIjZmY0NDAwIi8+PHRleHQgeD0iOCIgeT0iOCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iIGZpbGw9IndoaXRlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMCI+MzwvdGV4dD48L3N2Zz4='
  }
]

export const Default = () => (
  <SavedWebsites
    websites={sampleWebsites}
    on_delete={(url) => console.log('Delete website:', url)}
    on_link_click={(url) => console.log('Link click:', url)}
  />
)
