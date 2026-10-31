import type { GlobalConfig } from 'payload'
import { isAdmin } from '@/lib/access'
export const ResearchSettings: GlobalConfig = {
  slug: 'research-settings',
  label: 'تنظیمات پژوهش',
  access: { read: isAdmin, update: isAdmin },
  admin: { group: 'پژوهش' },
  fields: [
    { name: 'title', label: 'عنوان پژوهش', type: 'text', required: true },
    {
      name: 'description',
      label: 'شرح پژوهش',
      type: 'textarea',
      required: true,
    },
    { name: 'introduction', label: 'مقدمه', type: 'textarea', required: true },
    {
      name: 'consentText',
      label: 'رضایت آگاهانه',
      type: 'textarea',
      required: true,
      admin: {
        description:
          'هدف، اختیاری بودن، اطلاعات دریافتی، نحوه استفاده و نگهداری مشخصات اختیاری را توضیح دهید.',
      },
    },
    {
      name: 'consentVersion',
      label: 'نسخه رضایت',
      type: 'text',
      required: true,
    },
    {
      name: 'contact',
      label: 'اطلاعات تماس پژوهشگر',
      type: 'text',
      required: true,
    },
    {
      name: 'available',
      label: 'پرسش‌نامه باز است',
      type: 'checkbox',
      defaultValue: false,
    },
    { name: 'closingMessage', label: 'پیام بسته بودن', type: 'textarea' },
  ],
}
