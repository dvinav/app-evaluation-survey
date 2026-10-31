import { getRequestConfig } from 'next-intl/server'
export default getRequestConfig(async () => ({
  locale: 'fa',
  messages: (await import('../../messages/fa.json')).default,
}))
