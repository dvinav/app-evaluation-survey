import type { CollectionConfig, Field } from 'payload'
import { APIError } from 'payload'
import { immutableAccess, privateAccess, never } from '@/lib/access'

const text = (name: string, label: string, required = true): Field => ({
  name,
  label,
  type: 'text',
  required,
  ...(['firstName', 'surname', 'profileUrl', 'requestHash'].includes(name)
    ? { custom: { 'plugin-import-export': { disabled: true } } }
    : {}),
})
const relationship = (
  name: string,
  label: string,
  relationTo:
    | 'companies'
    | 'applications'
    | 'survey-submissions'
    | 'application-evaluations',
): Field => ({
  name,
  label,
  type: 'relationship',
  relationTo,
  required: true,
  index: true,
})
const modeOptions = [
  { label: 'عمومی', value: 'general' },
  { label: 'تفصیلی', value: 'detailed' },
]
const researchGroup = 'پژوهش'
const dataGroup = 'داده‌های پژوهش'

export const AdminUsers: CollectionConfig = {
  slug: 'admin-users',
  labels: { singular: 'مدیر', plural: 'مدیران' },
  auth: {
    tokenExpiration: 7200,
    maxLoginAttempts: 5,
    lockTime: 600000,
    cookies: {
      sameSite: 'Strict',
      secure: process.env.NODE_ENV === 'production',
    },
  },
  admin: { useAsTitle: 'email', group: 'مدیریت' },
  access: privateAccess,
  hooks: {
    beforeChange: [
      ({ req }) => {
        if (!req.user && !req.context.bootstrap)
          throw new APIError('ایجاد مدیر فقط از مسیر مدیریت مجاز است.', 403)
      },
    ],
  },
  fields: [text('name', 'نام مدیر')],
}

export const Companies: CollectionConfig = {
  slug: 'companies',
  labels: { singular: 'شرکت', plural: 'شرکت‌ها' },
  admin: {
    useAsTitle: 'name',
    group: researchGroup,
    defaultColumns: [
      'name',
      'participationStatus',
      'interviewAgreement',
      'interviewProgress',
    ],
  },
  access: { ...privateAccess, delete: never },
  fields: [
    text('name', 'نام شرکت'),
    text('website', 'وب‌سایت', false),
    { name: 'description', label: 'توضیحات', type: 'textarea' },
    {
      name: 'participationStatus',
      label: 'وضعیت مشارکت',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'در انتظار', value: 'pending' },
        { label: 'موافقت شده', value: 'agreed' },
        { label: 'انصراف', value: 'withdrawn' },
      ],
    },
    {
      name: 'interviewAgreement',
      label: 'موافقت با مصاحبه',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'interviewProgress',
      label: 'پیشرفت مصاحبه',
      type: 'select',
      defaultValue: 'not-scheduled',
      options: [
        { label: 'زمان‌بندی نشده', value: 'not-scheduled' },
        { label: 'زمان‌بندی شده', value: 'scheduled' },
        { label: 'انجام شده', value: 'completed' },
      ],
    },
    { name: 'privateNotes', label: 'یادداشت خصوصی', type: 'textarea' },
  ],
}

export const Applications: CollectionConfig = {
  slug: 'applications',
  labels: { singular: 'نرم‌افزار', plural: 'نرم‌افزارها' },
  admin: {
    useAsTitle: 'name',
    group: researchGroup,
    defaultColumns: ['name', 'company', 'public', 'active', 'displayOrder'],
  },
  access: { ...privateAccess, delete: never },
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, req }) => {
        const merged = { ...originalDoc, ...data }
        if (merged.public && merged.active) {
          const companyId =
            typeof merged.company === 'object'
              ? merged.company.id
              : merged.company
          const company = await req.payload.findByID({
            collection: 'companies',
            id: companyId,
            req,
          })
          if (
            company.participationStatus !== 'agreed' ||
            !company.interviewAgreement
          )
            throw new APIError(
              'شرکت باید با مشارکت و مصاحبه موافقت کرده باشد.',
              400,
            )
        }
        return data
      },
    ],
  },
  fields: [
    text('name', 'نام نرم‌افزار'),
    {
      name: 'icon',
      label: 'نماد',
      type: 'upload',
      relationTo: 'media',
      required: true,
    },
    relationship('company', 'شرکت', 'companies'),
    text('url', 'نشانی', false),
    text('category', 'دسته‌بندی', false),
    { name: 'active', label: 'فعال', type: 'checkbox', defaultValue: false },
    {
      name: 'public',
      label: 'نمایش عمومی',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'displayOrder',
      label: 'ترتیب نمایش',
      type: 'number',
      defaultValue: 0,
      required: true,
    },
  ],
}

export function questions(
  slug: 'general-questions' | 'detailed-questions',
  label: string,
): CollectionConfig {
  return {
    slug,
    labels: {
      singular: slug === 'general-questions' ? 'پرسش عمومی' : 'پرسش تفصیلی',
      plural: label,
    },
    access: privateAccess,
    admin: {
      useAsTitle: 'text',
      group: 'پرسش‌نامه‌ها',
      defaultColumns: ['stableId', 'text', 'version', 'active', 'displayOrder'],
    },
    hooks: {
      beforeChange: [
        ({ data, originalDoc, operation }) => {
          if (
            operation === 'update' &&
            data.stableId &&
            data.stableId !== originalDoc.stableId
          )
            throw new APIError('شناسه پایدار قابل تغییر نیست.', 400)
          return {
            ...data,
            version: operation === 'create' ? 1 : originalDoc.version + 1,
          }
        },
      ],
    },
    fields: [
      {
        name: 'stableId',
        label: 'شناسه پایدار',
        type: 'text',
        required: true,
        unique: true,
        admin: {
          description: 'پس از ایجاد تغییر نمی‌کند؛ برای نمونه usability-01',
        },
      },
      {
        name: 'text',
        label: 'متن فارسی پرسش',
        type: 'textarea',
        required: true,
      },
      { name: 'description', label: 'راهنمای پرسش', type: 'textarea' },
      {
        name: 'displayOrder',
        label: 'ترتیب',
        type: 'number',
        required: true,
        defaultValue: 0,
      },
      {
        name: 'required',
        label: 'پاسخ الزامی',
        type: 'checkbox',
        defaultValue: true,
      },
      { name: 'active', label: 'فعال', type: 'checkbox', defaultValue: false },
      text('dimension', 'سازه پژوهش (اختیاری)', false),
      {
        name: 'reverseScored',
        label: 'نمره‌گذاری معکوس در تحلیل',
        type: 'checkbox',
        defaultValue: false,
      },
      {
        name: 'allowNA',
        label: 'امکان انتخاب قابل ارزیابی نیست',
        type: 'checkbox',
        defaultValue: false,
      },
      {
        name: 'version',
        label: 'نسخه (خودکار)',
        type: 'number',
        required: true,
        defaultValue: 1,
        admin: { readOnly: true },
      },
    ],
  }
}
export const GeneralQuestions = questions('general-questions', 'پرسش‌های عمومی')
export const DetailedQuestions = questions(
  'detailed-questions',
  'پرسش‌های تفصیلی',
)

export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'رسانه', plural: 'رسانه‌ها' },
  access: { ...privateAccess, read: () => true },
  admin: { group: researchGroup },
  upload: {
    staticDir: process.env.MEDIA_DIR || 'media',
    mimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/avif'],
    imageSizes: [{ name: 'icon', width: 96, height: 96, fit: 'contain' }],
  },
  fields: [text('alt', 'متن جایگزین')],
}

export const SurveySubmissions: CollectionConfig = {
  slug: 'survey-submissions',
  labels: { singular: 'مشارکت', plural: 'مشارکت‌ها' },
  access: immutableAccess,
  admin: {
    group: dataGroup,
    useAsTitle: 'submissionId',
    defaultColumns: ['submissionId', 'mode', 'background', 'createdAt'],
  },
  fields: [
    {
      name: 'submissionId',
      label: 'شناسه مشارکت',
      type: 'text',
      required: true,
      unique: true,
    },
    text('requestHash', 'اثر انگشت درخواست'),
    text('firstName', 'نام (اختیاری)', false),
    text('surname', 'نام خانوادگی (اختیاری)', false),
    {
      name: 'background',
      label: 'زمینه حرفه‌ای',
      type: 'select',
      required: true,
      options: [
        { label: 'متخصص رابط یا تجربه کاربری', value: 'ui-ux' },
        { label: 'مرتبط با توسعه نرم‌افزار', value: 'software' },
        { label: 'سایر', value: 'other' },
      ],
    },
    text('profileUrl', 'نشانی حرفه‌ای', false),
    {
      name: 'mode',
      label: 'نوع پرسش‌نامه',
      type: 'select',
      required: true,
      options: modeOptions,
      index: true,
    },
    text('questionnaireVersion', 'نسخه ابزار'),
    text('consentVersion', 'نسخه رضایت'),
    { name: 'consentedAt', label: 'زمان رضایت', type: 'date', required: true },
    {
      name: 'snapshot',
      label: 'تصویر تغییرناپذیر ابزار و رضایت',
      type: 'json',
      required: true,
      custom: { 'plugin-import-export': { disabled: true } },
    },
  ],
}

export const ApplicationEvaluations: CollectionConfig = {
  slug: 'application-evaluations',
  labels: { singular: 'ارزیابی', plural: 'ارزیابی‌ها' },
  access: immutableAccess,
  admin: {
    group: dataGroup,
    defaultColumns: ['submission', 'application', 'mode', 'createdAt'],
  },
  fields: [
    relationship('submission', 'مشارکت', 'survey-submissions'),
    relationship('application', 'نرم‌افزار', 'applications'),
    relationship('company', 'شرکت', 'companies'),
    text('applicationName', 'نام نرم‌افزار در زمان ارزیابی'),
    text('companyName', 'نام شرکت در زمان ارزیابی'),
    {
      name: 'mode',
      label: 'نوع',
      type: 'select',
      required: true,
      options: modeOptions,
    },
    text('questionnaireVersion', 'نسخه ابزار'),
    {
      name: 'questionCount',
      label: 'تعداد پرسش‌ها',
      type: 'number',
      required: true,
    },
  ],
}

export const QuestionResponses: CollectionConfig = {
  slug: 'question-responses',
  labels: { singular: 'پاسخ', plural: 'پاسخ‌های پرسش‌ها' },
  access: immutableAccess,
  admin: {
    group: dataGroup,
    defaultColumns: ['evaluation', 'questionId', 'rating', 'status'],
  },
  fields: [
    relationship('evaluation', 'ارزیابی', 'application-evaluations'),
    text('questionId', 'شناسه پایدار پرسش'),
    text('questionText', 'متن پرسش در زمان پاسخ'),
    {
      name: 'questionVersion',
      label: 'نسخه پرسش',
      type: 'number',
      required: true,
    },
    text('dimension', 'سازه', false),
    { name: 'reverseScored', label: 'معکوس', type: 'checkbox', required: true },
    {
      name: 'required',
      label: 'الزامی در زمان پاسخ',
      type: 'checkbox',
      required: true,
    },
    {
      name: 'status',
      label: 'وضعیت پاسخ',
      type: 'select',
      required: true,
      options: [
        { label: 'امتیاز داده شده', value: 'rated' },
        { label: 'قابل ارزیابی نیست', value: 'not-applicable' },
        { label: 'بدون پاسخ', value: 'unanswered' },
      ],
    },
    {
      name: 'rating',
      label: 'نمره خام',
      type: 'number',
      min: 1,
      max: 7,
      validate: (value: unknown) =>
        value == null ||
        (typeof value === 'number' &&
          Number.isInteger(value) &&
          value >= 1 &&
          value <= 7) ||
        'نمره باید عدد صحیح از ۱ تا ۷ باشد.',
    },
  ],
}

export const ResearchResultsContacts: CollectionConfig = {
  slug: 'research-results-contacts',
  labels: { singular: 'درخواست نتایج', plural: 'درخواست‌های نتایج' },
  access: immutableAccess,
  admin: { group: 'اطلاعات محرمانه', useAsTitle: 'email' },
  fields: [
    { name: 'email', label: 'ایمیل', type: 'email', required: true },
    relationship(
      'submission',
      'مشارکت (فقط برای حذف داده)',
      'survey-submissions',
    ),
    {
      name: 'subscribedAt',
      label: 'زمان درخواست',
      type: 'date',
      required: true,
    },
  ],
}
