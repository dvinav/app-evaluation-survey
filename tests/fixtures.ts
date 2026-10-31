import type { Snapshot, ParticipantInput } from '../src/lib/validation'
export const participant: ParticipantInput = {
  firstName: '',
  surname: '',
  specialist: false,
  softwareRelated: false,
  profileUrl: '',
  receiveResults: false,
  email: '',
  detailed: false,
  consent: true,
}
export const snapshot: Snapshot = {
  version: 'fixture-version',
  mode: 'general',
  questions: [
    {
      id: 'q1',
      text: 'پرسش نمایشی',
      description: '',
      version: 1,
      required: true,
      allowNA: false,
      dimension: 'usability',
      reverseScored: false,
    },
    {
      id: 'q2',
      text: 'پرسش اختیاری',
      description: '',
      version: 1,
      required: false,
      allowNA: true,
      dimension: 'aesthetics',
      reverseScored: true,
    },
  ],
  applications: [
    {
      id: 1,
      name: 'نمایشی',
      companyId: 1,
      companyName: 'شرکت نمایشی',
      icon: '',
    },
    {
      id: 2,
      name: 'نمایشی دوم',
      companyId: 1,
      companyName: 'شرکت نمایشی',
      icon: '',
    },
  ],
  consent: {
    text: 'رضایت نمایشی',
    version: '1',
    contact: 'researcher@example.org',
    title: 'پژوهش نمایشی',
    introduction: 'مقدمه',
  },
  scale: { min: 1, max: 7, low: 'کاملاً مخالفم', high: 'کاملاً موافقم' },
}
