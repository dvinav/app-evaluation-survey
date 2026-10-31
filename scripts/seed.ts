import 'dotenv/config'
import { runMaintenance } from './run-maintenance'
import sharp from 'sharp'
import { getCMS } from '../src/lib/payload'
export async function seedDemo() {
  if (
    process.env.NODE_ENV === 'production' ||
    process.env.ALLOW_DEMO_SEED !== 'true'
  )
    throw new Error('Set ALLOW_DEMO_SEED=true on a development database only.')
  const payload = await getCMS()
  const existing = await payload.count({ collection: 'companies' })
  if (existing.totalDocs)
    throw new Error('Demo seeding requires an empty company collection.')
  const buffer = await sharp({
    create: { width: 96, height: 96, channels: 4, background: '#2563eb' },
  })
    .png()
    .toBuffer()
  const icon = await payload.create({
    collection: 'media',
    data: { alt: 'نماد نرم‌افزار نمایشی' },
    file: {
      data: buffer,
      mimetype: 'image/png',
      name: 'demonstration-icon.png',
      size: buffer.length,
    },
  })
  const company = await payload.create({
    collection: 'companies',
    data: {
      name: 'شرکت نمایشی پژوهش',
      participationStatus: 'agreed',
      interviewAgreement: true,
      website: 'https://example.org',
    },
  })
  for (const [index, name] of [
    'نرم‌افزار نمایشی الف',
    'نرم‌افزار نمایشی ب',
  ].entries())
    await payload.create({
      collection: 'applications',
      data: {
        name,
        company: company.id,
        icon: icon.id,
        active: true,
        public: true,
        displayOrder: index,
      },
    })
  for (const collection of [
    'general-questions',
    'detailed-questions',
  ] as const) {
    await payload.create({
      collection,
      data: {
        stableId: 'demo-01',
        version: 1,
        text: 'پرسش نمایشی: ظاهر این نرم‌افزار را می‌پسندم.',
        description:
          'صرفاً برای آزمایش نرم‌افزار؛ ابزار پژوهشی اعتبارسنجی‌شده نیست.',
        required: true,
        active: true,
        displayOrder: 1,
        dimension: 'demonstration',
      },
    })
    await payload.create({
      collection,
      data: {
        stableId: 'demo-02',
        version: 1,
        text: 'پرسش نمایشی: یافتن بخش‌های نرم‌افزار برای من دشوار است.',
        description:
          'صرفاً برای آزمایش؛ نمره معکوس در تحلیل توصیفی محاسبه می‌شود.',
        required: false,
        allowNA: true,
        reverseScored: true,
        active: true,
        displayOrder: 2,
        dimension: 'demonstration',
      },
    })
  }
  await payload.updateGlobal({
    slug: 'research-settings',
    data: {
      title: 'پژوهش نمایشی ارزیابی نرم‌افزار',
      description: 'محیط نمایشی؛ از ثبت اطلاعات واقعی خودداری کنید.',
      introduction:
        'در این نمونه می‌توانید مراحل ارزیابی تجربهٔ نرم‌افزار را آزمایش کنید.',
      consentText:
        'این محیط فقط برای نمایش و آزمایش است و ابزار معتبر پژوهشی نیست. شرکت در آن اختیاری است. نام، نام خانوادگی و نشانی حرفه‌ای اختیاری هستند. پاسخ‌ها برای آزمایش عملکرد سامانه نگهداری می‌شوند؛ ایمیل اختیاری جدا از داده‌های تحلیلی ذخیره می‌شود. پیش از ثبت می‌توانید صفحه را ببندید. داده‌های واقعی پژوهش نباید در این محیط ثبت شوند.',
      consentVersion: 'demo-1',
      contact: 'researcher@example.org',
      available: true,
    },
  })
  return payload
}
if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  await runMaintenance(async () => {
    const payload = await seedDemo()
    console.log(
      'Synthetic demonstration data created. Replace both instruments before research use.',
    )
    await payload.destroy()
  })
}
