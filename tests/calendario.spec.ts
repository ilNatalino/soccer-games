import { expect, test } from '@playwright/test'
import { derby } from '../src/derby'

const schedule = {
  '2026-10-25': 'milan',
  '2026-10-26': 'roma',
  '2026-11-14': 'roma',
  '2026-11-21': 'roma',
  '2026-11-22': 'milan',
  '2026-11-23': 'roma',
}
const matches = [
  {
    ...derby,
    game: { ...derby.game, game_id: 'milan' },
    quiz_side: 'home',
    lineups: [{
      ...derby.lineups[0],
      team_id: derby.game.home.team_id,
      starting_xi: derby.lineups[0].starting_xi.map(player => {
        if (player.jersey === '22') return { ...player, name: 'Diego Milito', short_name: 'D. Milito' }
        if (player.jersey === '8') return { ...player, short_name: null }
        return player
      }),
    }],
  },
  {
    ...derby,
    game: { ...derby.game, game_id: 'roma', home: { ...derby.game.home, name: 'Roma' } },
    lineups: [{ ...derby.lineups[0], formation: '4-1-2-1-2' }],
  },
]

test.use({ timezoneId: 'America/New_York' })

test.beforeEach(async ({ page }) => {
  await page.route(url => url.pathname === '/src/calendar.json', route => route.fulfill({
    contentType: 'text/javascript',
    body: `export default ${JSON.stringify(schedule)}`,
  }))
  await page.route(url => url.pathname === '/src/strikerapi.ts' && !url.searchParams.has('original'), route => route.fulfill({
    contentType: 'text/javascript',
    body: `
      export { orderStarters, quizPlayerName, teamColors } from '/src/strikerapi.ts?original'
      export const strikerMatches = ${JSON.stringify(matches)}
    `,
  }))
})

test('sceglie il giorno prima di iniziare e ritrova i tentativi tornando alla sfida', async ({ page, isMobile }) => {
  await page.clock.setFixedTime(new Date('2026-11-21T23:30:00Z'))
  if (isMobile) await page.setViewportSize({ width: 320, height: 640 })
  await page.goto('/')

  const calendar = page.getByRole('navigation', { name: 'Calendario delle sfide' })
  const activeDate = calendar.locator('[aria-current="page"] time')
  const dateLinks = calendar.getByRole('link')
  const field = page.locator('.pitch')
  const match = page.locator('.match')
  const start = page.getByRole('button', { name: 'Inizia', exact: true })
  await expect(calendar).toBeVisible()
  await expect(match).toBeVisible()
  await expect(start).toBeInViewport({ ratio: 1 })
  await expect(field).toHaveCount(0)

  await expect(dateLinks).toHaveCount(8)
  await expect(dateLinks.first()).toHaveText('Oggi')
  const datePositions = await dateLinks.evaluateAll(links => links.map(link => {
    const { top, right } = link.getBoundingClientRect()
    return { top, right }
  }))
  expect(datePositions).toEqual([...datePositions].sort((a, b) => a.top - b.top || b.right - a.right))
  await expect(activeDate).toHaveText('Oggi')
  await expect(activeDate).toHaveAttribute('datetime', '2026-11-22')
  await expect(calendar.locator('time').last()).toHaveAttribute('datetime', '2026-11-15')
  await expect(page.getByRole('heading', { name: 'Milan 0–4 Inter' })).toBeVisible()
  await expect(match.locator('time')).toHaveAttribute('datetime', '2009-08-29')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  const yesterday = calendar.locator('a[href="?giorno=2026-11-21"]')
  if (isMobile) await yesterday.tap()
  else await yesterday.click()
  await expect(activeDate).toHaveAttribute('datetime', '2026-11-21')
  await expect(page.getByRole('heading', { name: 'Roma 0–4 Inter' })).toBeVisible()
  await expect(field).toHaveCount(0)
  const calendarPosition = await calendar.boundingBox()
  const matchPosition = await match.boundingBox()
  await start.click()

  await expect(page.getByRole('heading', { name: 'Inter', exact: true })).toBeVisible()
  expect(await calendar.boundingBox()).toEqual(calendarPosition)
  expect(await match.boundingBox()).toEqual(matchPosition)
  await expect(page.getByRole('textbox', { name: 'Il tuo tentativo' })).toBeDisabled()
  await expect(field.locator('.pitch-row')).toHaveCount(6)
  const panel = page.getByRole('region', { name: 'Tentativi' })
  const { width, height } = (await field.boundingBox())!
  expect(await panel.boundingBox()).toMatchObject({ width, height })
  expect(await field.evaluate(element => element.scrollHeight <= element.clientHeight)).toBe(true)

  const today = calendar.getByRole('link', { name: 'Oggi' })
  await today.click()
  await expect(field).toHaveCount(0)
  await start.click()
  expect(await field.boundingBox()).toMatchObject({ width, height })
  expect(await panel.boundingBox()).toMatchObject({ width, height })
  await page.getByRole('button', { name: /^Maglia 9,/ }).click()
  await page.getByRole('textbox', { name: 'Il tuo tentativo' }).fill('AAAA')
  await page.getByRole('button', { name: 'Invia' }).click()
  const firstAttempt = page.getByRole('group', { name: 'Tentativo 1', exact: true })
  await expect(firstAttempt.getByRole('img', { name: 'A: assente' })).toHaveCount(4)

  await yesterday.click()
  await expect(activeDate).toHaveAttribute('datetime', '2026-11-21')
  await expect(page.getByRole('heading', { name: 'Roma 0–4 Inter' })).toBeVisible()

  await today.click()
  await page.reload()
  await expect(firstAttempt.getByRole('img', { name: 'A: assente' })).toHaveCount(4)
  await expect(calendar).toBeVisible()
  await expect(match).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Milan', exact: true })).toBeVisible()
  await expect(start).toHaveCount(0)

  await page.getByRole('button', { name: 'Termina', exact: true }).click()
  await page.getByRole('button', { name: 'Rivela e concludi', exact: true }).click()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Sfida conclusa' })).toBeVisible()
  await expect(calendar).toBeVisible()
  await expect(start).toHaveCount(0)
})

test('usa il nome breve senza iniziale e ripiega sul nome della formazione', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-22T12:00:00Z'))
  await page.goto('/')
  await page.getByRole('button', { name: 'Inizia', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Milan', exact: true })).toBeVisible()

  for (const [jersey, guess, name] of [['22', 'MILITO', 'Milito'], ['8', 'THIAGOMOTTA', 'Thiago Motta']]) {
    await page.getByRole('button', { name: new RegExp(`^Maglia ${jersey},`) }).click()
    await page.getByRole('textbox', { name: 'Il tuo tentativo' }).fill(guess)
    await page.getByRole('button', { name: 'Invia', exact: true }).click()
    await expect(page.getByRole('button', { name: `Maglia ${jersey}, ${name}, Indovinato` })).toBeVisible()
  }
})

test('mostra le date senza sfida e limita i link diretti agli otto giorni', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-22T12:00:00Z'))
  await page.goto('/')
  const calendar = page.getByRole('navigation', { name: 'Calendario delle sfide' })
  await calendar.locator('a[href="?giorno=2026-11-20"]').click()
  await expect(page.getByRole('heading', { name: 'Sfida non disponibile' })).toBeVisible()
  await expect(calendar).toBeVisible()
  await expect(page.getByRole('button', { name: 'Inizia', exact: true })).toHaveCount(0)
  await expect(page.locator('[aria-current="page"] time')).toHaveAttribute('datetime', '2026-11-20')

  for (const date of ['2026-11-14', '2026-11-23']) {
    await page.goto(`/?giorno=${date}`)
    await expect(page.getByRole('heading', { name: 'Milan 0–4 Inter' })).toBeVisible()
    await expect(page.locator('[aria-current="page"] time')).toHaveAttribute('datetime', '2026-11-22')
    await expect(page.getByRole('button', { name: 'Inizia', exact: true })).toBeVisible()
  }
})

test('cambia sfida a mezzanotte italiana anche nel giorno del cambio d’ora', async ({ page }) => {
  const italianMidnight = new Date('2026-10-24T22:00:00Z')
  await page.clock.install({ time: new Date('2026-10-24T21:59:50Z') })
  await page.clock.pauseAt(italianMidnight)
  await page.goto('/')
  const activeDate = page.locator('[aria-current="page"] time')
  const start = page.getByRole('button', { name: 'Inizia', exact: true })
  await expect(activeDate).toHaveAttribute('datetime', '2026-10-25')
  await expect(page.getByRole('heading', { name: 'Milan 0–4 Inter' })).toBeVisible()
  await start.press('Enter')

  await page.clock.fastForward(25 * 60 * 60 * 1000 - 1)
  await expect(activeDate).toHaveAttribute('datetime', '2026-10-25')
  await page.clock.runFor(1)
  await expect(start).toBeVisible()
  await expect(activeDate).toHaveAttribute('datetime', '2026-10-26')
  await expect(page.getByRole('heading', { name: 'Roma 0–4 Inter' })).toBeVisible()
  await expect(page.locator('.pitch')).toHaveCount(0)
})
