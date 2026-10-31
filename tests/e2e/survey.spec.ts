import { expect, test } from '@playwright/test'
import { createTranslator } from 'next-intl'
import messages from '../../messages/fa.json' with { type: 'json' }
const t = messages.survey
const translate = createTranslator({
  locale: 'fa',
  messages,
  namespace: 'survey',
})
for (const mode of ['general', 'detailed'] as const)
  test(`completes ${mode} survey with two applications and preserved back navigation`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa')
    await expect(page.locator('body')).not.toContainText(
      'Internal Server Error',
    )
    const software = page.getByRole('checkbox', {
      name: t.softwareRelated,
      exact: true,
    })
    await expect(software).toBeVisible()
    const relatedBox = await software.boundingBox()
    const specialistBox = await page
      .getByRole('checkbox', { name: t.specialist, exact: true })
      .boundingBox()
    expect(Math.abs(relatedBox!.x - specialistBox!.x)).toBeLessThan(1)
    await page
      .getByRole('checkbox', { name: t.specialist, exact: true })
      .check()
    await expect(software).not.toBeVisible()
    await page
      .getByLabel(t.profileUrl, { exact: false })
      .fill('https://example.org')
    await page
      .getByRole('checkbox', { name: t.specialist, exact: true })
      .uncheck()
    await expect(
      page.getByLabel(t.profileUrl, { exact: false }),
    ).not.toBeVisible()
    if (mode === 'detailed')
      await page
        .getByRole('checkbox', { name: t.detailed, exact: true })
        .check()
    await page.getByRole('button', { name: t.next, exact: true }).click()
    await expect(page.getByText(t.validation.consentRequired)).toBeVisible()
    await page.getByRole('checkbox', { name: t.consent, exact: true }).check()
    await page.getByRole('button', { name: t.next, exact: true }).click()
    await page.getByRole('button', { name: t.next, exact: true }).click()
    await expect(page.getByText(t.validation.selectionRequired)).toBeVisible()
    const cards = page.locator('.application-card')
    await expect
      .poll(() =>
        cards
          .first()
          .locator('img')
          .evaluate(
            (image: HTMLImageElement) =>
              image.complete && image.naturalWidth > 0,
          ),
      )
      .toBe(true)
    await expect(cards.first().locator('img')).toHaveAttribute('src', /^\//)
    await cards.nth(0).click()
    await cards.nth(1).click()
    const firstBox = await cards.nth(0).boundingBox(),
      secondBox = await cards.nth(1).boundingBox()
    expect(secondBox!.y).toBeGreaterThan(firstBox!.y + firstBox!.height)
    await page.getByRole('button', { name: t.next, exact: true }).click()
    await page
      .locator('.rating-question')
      .first()
      .getByRole('radio', {
        name: translate('ratingLabel', { rating: 7 }),
        exact: true,
      })
      .check()
    await page.getByRole('button', { name: t.next, exact: true }).click()
    await page.getByRole('button', { name: t.previous, exact: true }).click()
    await expect(
      page
        .locator('.rating-question')
        .first()
        .getByRole('radio', {
          name: translate('ratingLabel', { rating: 7 }),
          exact: true,
        }),
    ).toBeChecked()
    await page.getByRole('button', { name: t.next, exact: true }).click()
    await page
      .locator('.rating-question')
      .first()
      .getByRole('radio', {
        name: translate('ratingLabel', { rating: 5 }),
        exact: true,
      })
      .check()
    await page
      .locator('.rating-question')
      .nth(1)
      .getByRole('radio', { name: t.notApplicable, exact: true })
      .check()
    await page.getByRole('button', { name: t.submit, exact: true }).click()
    await expect(
      page.getByRole('heading', { name: t.successTitle }),
    ).toBeVisible()
    expect(errors).toEqual([])
    await expect(page.locator('body')).not.toContainText('submissionId')
  })
test('supports themes, small screens and keyboard navigation', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByText(messages.common.theme, { exact: true }).click()
  await page
    .getByRole('button', { name: messages.common.light, exact: true })
    .click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  for (let attempt = 0; attempt < 12; attempt++) {
    if (
      await page
        .getByRole('link', { name: messages.common.skip })
        .evaluate((element) => element === document.activeElement)
    )
      break
    await page.keyboard.press('Shift+Tab')
  }
  await expect(
    page.getByRole('link', { name: messages.common.skip }),
  ).toBeFocused()
  await page.screenshot({
    path: `test-results/survey-${test.info().project.name}.png`,
    fullPage: true,
  })
})
test('keeps answers for an identical retry after a lost response', async ({
  page,
}) => {
  let attempts = 0
  await page.route('**/api/survey/submit', async (route) => {
    attempts++
    const result = await route.fetch()
    if (attempts === 1) await route.abort('failed')
    else await route.fulfill({ response: result })
  })
  await page.goto('/')
  await page.getByRole('checkbox', { name: t.consent, exact: true }).check()
  await page.getByRole('button', { name: t.next, exact: true }).click()
  await page.locator('.application-card').first().click()
  await page.getByRole('button', { name: t.next, exact: true }).click()
  await page
    .locator('.rating-question')
    .first()
    .getByRole('radio', {
      name: translate('ratingLabel', { rating: 6 }),
      exact: true,
    })
    .check()
  await page.getByRole('button', { name: t.submit, exact: true }).click()
  await expect(
    page.getByRole('alert').filter({ hasText: t.validation.submissionFailed }),
  ).toHaveText(t.validation.submissionFailed)
  await page.getByRole('button', { name: t.submit, exact: true }).click()
  await expect(
    page.getByRole('heading', { name: t.successTitle }),
  ).toBeVisible()
  expect(attempts).toBe(2)
})

test('renders unmatched URLs in Persian', async ({ page }) => {
  const response = await page.goto('/missing-research-page')
  expect(response?.status()).toBe(404)
  await expect(
    page.getByRole('heading', { name: messages.common.notFound }),
  ).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
})

test('administrator can inspect descriptive results and download analytical exports', async ({
  page,
}) => {
  test.skip(
    !process.env.E2E_ADMIN_EMAIL || !process.env.E2E_ADMIN_PASSWORD,
    'Set synthetic admin credentials to exercise authenticated UI',
  )
  const login = await page.request.post('/api/admin-users/login', {
    data: {
      email: process.env.E2E_ADMIN_EMAIL,
      password: process.env.E2E_ADMIN_PASSWORD,
    },
  })
  expect(login.ok()).toBe(true)
  const nativeExport = await page.request.post('/api/exports/download', {
    headers: { Origin: process.env.E2E_BASE_URL || 'http://localhost:3000' },
    data: { data: { collectionSlug: 'survey-submissions', format: 'json' } },
  })
  expect(nativeExport.ok()).toBe(true)
  const nativeBody = await nativeExport.text()
  expect(nativeBody).toContain('questionnaireVersion')
  expect(nativeBody).not.toMatch(
    /"firstName"|"surname"|"profileUrl"|"requestHash"|"snapshot"/,
  )
  await page.goto('/admin')
  await expect(
    page.getByRole('heading', { name: messages.admin.title, exact: true }),
  ).toBeVisible()
  await expect(
    page.locator('.research-dashboard tbody tr').first(),
  ).toBeVisible()
  await page
    .locator('.research-dashboard select[name="dataset"]')
    .selectOption('answers')
  const download = page.waitForEvent('download')
  await page
    .getByRole('button', { name: messages.admin.export, exact: true })
    .click()
  expect((await download).suggestedFilename()).toBe('answers.csv')
  expect(await (await download).failure()).toBeNull()
  await page.goto('/admin/collections/general-questions')
  await expect(
    page.getByRole('cell', { name: 'demo-01', exact: true }),
  ).toBeVisible()
})

test('animates controls and suppresses motion when requested', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  const control = page.getByRole('checkbox', {
    name: t.specialist,
    exact: true,
  })
  expect(
    await control.evaluate(
      (element) => getComputedStyle(element).transitionDuration,
    ),
  ).not.toBe('0s')
  await control.check()
  await expect(page.getByLabel(t.profileUrl, { exact: false })).toBeVisible()
  await control.uncheck()
  await control.check()
  await expect(page.getByLabel(t.profileUrl, { exact: false })).toBeVisible()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(
    await control.evaluate(
      (element) => getComputedStyle(element).transitionDuration,
    ),
  ).toBe('0s')
})
