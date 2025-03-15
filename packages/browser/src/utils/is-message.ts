import { Message } from '@/types/messages'

export function is_message(obj: any): obj is Message {
  return obj && typeof obj.action === 'string'
}
