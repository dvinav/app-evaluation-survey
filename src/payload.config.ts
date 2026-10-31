import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { fa } from '@payloadcms/translations/languages/fa'
import { importExportPlugin } from '@payloadcms/plugin-import-export'
import sharp from 'sharp'
import {
  AdminUsers,
  Companies,
  Applications,
  GeneralQuestions,
  DetailedQuestions,
  Media,
  SurveySubmissions,
  ApplicationEvaluations,
  QuestionResponses,
  ResearchResultsContacts,
} from '@/collections/research'
import { ResearchSettings } from '@/globals/ResearchSettings'
import { privateAccess } from '@/lib/access'
import { spreadsheetSafe } from '@/lib/exports'

const dirname = path.dirname(fileURLToPath(import.meta.url))
export default buildConfig({
  telemetry: false,
  cors:
    process.env.NODE_ENV === 'development'
      ? '*'
      : [process.env.SERVER_URL || 'http://localhost:3000'],
  secret: process.env.PAYLOAD_SECRET || '',
  serverURL: process.env.SERVER_URL || 'http://localhost:3000',
  admin: {
    user: 'admin-users',
    importMap: { baseDir: dirname },
    components: {
      beforeDashboard: ['/components/ResearchDashboard#ResearchDashboard'],
    },
  },
  i18n: { supportedLanguages: { fa }, fallbackLanguage: 'fa' },
  collections: [
    AdminUsers,
    Companies,
    Applications,
    GeneralQuestions,
    DetailedQuestions,
    Media,
    SurveySubmissions,
    ApplicationEvaluations,
    QuestionResponses,
    ResearchResultsContacts,
  ],
  globals: [ResearchSettings],
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URL || '' },
    push: false,
    migrationDir: path.resolve(dirname, 'migrations'),
  }),
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  sharp,
  email: () => ({
    name: 'disabled',
    defaultFromAddress: 'no-reply@localhost.invalid',
    defaultFromName: 'Survey administration',
    sendEmail: async () => {
      throw new Error(
        'Email delivery is disabled. Use the documented administrator recovery command.',
      )
    },
  }),
  graphQL: { disable: true },
  csrf: [process.env.SERVER_URL || 'http://localhost:3000'],
  plugins: [
    importExportPlugin({
      collections: (
        [
          'companies',
          'applications',
          'general-questions',
          'detailed-questions',
          'survey-submissions',
          'application-evaluations',
          'question-responses',
        ] as const
      ).map((slug) => ({
        slug,
        import: false,
        export: {
          disableSave: true,
          disableJobsQueue: true,
          hooks: {
            before: ({ data, format }) =>
              format === 'csv'
                ? data.map((row) =>
                    Object.fromEntries(
                      Object.entries(row).map(([key, value]) => [
                        key,
                        typeof value === 'string'
                          ? spreadsheetSafe(value)
                          : value,
                      ]),
                    ),
                  )
                : data,
          },
        },
      })),
      overrideExportCollection: ({ collection }) => ({
        ...collection,
        access: privateAccess,
      }),
      overrideImportCollection: ({ collection }) => ({
        ...collection,
        access: privateAccess,
      }),
    }),
  ],
})
