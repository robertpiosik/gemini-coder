export const HOME_VIEW_TYPES = {
  WEB: 'Open chatbot',
  API: 'Call API'
}

export type HomeViewType =
  (typeof HOME_VIEW_TYPES)[keyof typeof HOME_VIEW_TYPES]
