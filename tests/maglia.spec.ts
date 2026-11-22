import { expect, test, type Page } from '@playwright/test'

const demoUrl = '/?partita=demo'

test('il derby mostra undici maglie e permette di aprire la numero 9', async ({ page, isMobile }) => {
  if (isMobile) await page.setViewportSize({ width: 320, height: 640 })
  await page.goto(demoUrl)
  const title = page.getByRole('heading', { name: 'Milan 0–4 Inter', exact: true })
  const date = page.getByText('29 agosto 2009', { exact: true })
  await expect(title).toBeVisible()
  await expect(date).toBeVisible()
  const titlePosition = (await title.boundingBox())!
  const datePosition = (await date.boundingBox())!
  expect(datePosition.x).toBeGreaterThan(titlePosition.x + titlePosition.width)
  expect(Math.abs(datePosition.y - titlePosition.y)).toBeLessThan(2)
  await expect(page.getByRole('heading', { name: 'Inter', exact: true })).toBeVisible()
  await expect(page.getByText('4-3-1-2', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Maglia / })).toHaveCount(11)
  await expect(page.locator('.scorer-icon')).toHaveCount(4)
  for (const number of [5, 8, 13, 22]) {
    const scorer = page.getByRole('button', { name: new RegExp(`^Maglia ${number},`) })
    await expect(scorer.locator('.scorer-icon')).toBeVisible()
    await expect(scorer).toHaveAccessibleDescription('Marcatore')
  }
  await expect(page.locator('.player-attempts')).toHaveCount(0)

  const field = page.locator('.pitch')
  const panel = page.getByRole('region', { name: 'Tentativi', exact: true })
  const input = panel.getByRole('textbox', { name: 'Il tuo tentativo' })
  await expect(panel.locator('form:first-child > input:first-child')).toBeVisible()
  await expect(input).toBeDisabled()
  const fieldSize = (await field.boundingBox())!
  const { width, height } = fieldSize
  expect(await panel.boundingBox()).toMatchObject({ width, height })

  const shirt = page.getByRole('button', { name: 'Maglia 9, attaccante', exact: true })
  if (isMobile) await shirt.tap()
  else await shirt.click()

  await expect(panel.getByRole('heading')).toHaveCount(0)
  await expect(panel).not.toContainText(/Tocca a te|Il tuo tentativo|Inserisci solo le lettere|tentativi inviati|attaccante|4 lettere/)
  await expect(input).toBeFocused()
  await expect(page.getByRole('button', { name: 'Invia', exact: true })).toBeDisabled()
  const row = page.getByRole('group', { name: 'Tentativo 1', exact: true })
  await expect(row.getByLabel('Casella vuota')).toHaveCount(4)
  expect(await field.boundingBox()).toMatchObject({ width, height })
  expect(await panel.boundingBox()).toMatchObject({ width, height })
  expect(await panel.evaluate(element => element.scrollHeight <= element.clientHeight)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('si corregge una riga prima di inviarla e le O duplicate ricevono il feedback Wordle', async ({ page }) => {
  await page.goto(demoUrl)
  await page.getByRole('button', { name: 'Maglia 9, attaccante', exact: true }).click()
  const input = page.getByRole('textbox', { name: 'Il tuo tentativo' })
  const submit = page.getByRole('button', { name: 'Invia', exact: true })
  const first = page.getByRole('group', { name: 'Tentativo 1', exact: true })
  const { x, width } = (await input.boundingBox())!
  expect(await first.boundingBox()).toMatchObject({ x, width })

  await input.pressSequentially('oo')
  await expect(submit).toBeDisabled()
  await input.press('Enter')
  await expect(input).toHaveValue('OO')
  await input.press('Backspace')
  await input.pressSequentially('ooo')
  await expect(input).toHaveValue('OOOO')
  await expect(submit).toBeEnabled()
  await input.press('Enter')

  for (const [index, label] of ['O: assente', 'O: assente', 'O: posizione corretta', 'O: posizione corretta'].entries()) {
    await expect(first.getByRole('img').nth(index)).toHaveAccessibleName(label)
  }
  await expect(input).toHaveValue('')
  await expect(input).toBeFocused()

  await input.fill('OTTO')
  await submit.click()
  const second = page.getByRole('group', { name: 'Tentativo 2', exact: true })
  for (const [index, label] of ['O: presente altrove', 'T: posizione corretta', 'T: assente', 'O: posizione corretta'].entries()) {
    await expect(second.getByRole('img').nth(index)).toHaveAccessibleName(label)
  }
})

test('si sceglie con la tastiera e ETOO chiude la maglia come indovinata', async ({ page }) => {
  await page.goto(demoUrl)
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Maglia 9, attaccante', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  const input = page.getByRole('textbox', { name: 'Il tuo tentativo' })
  await input.pressSequentially('etxo')
  await input.press('ArrowLeft')
  await input.press('Backspace')
  await input.pressSequentially('o')
  await expect(input).toHaveValue('ETOO')
  await input.press('Enter')

  const shirt = page.getByRole('button', { name: 'Maglia 9, Eto’o, Indovinato' })
  await expect(shirt).toBeFocused()
  await expect(page.getByRole('region', { name: 'Tentativi', exact: true })).not.toContainText(/Eto’o|Indovinato|tentativi inviati/)
  await expect(shirt.locator('.player-attempts')).toHaveText('1')
  await expect(shirt).toHaveAccessibleDescription('1 tentativo')
  await expect(shirt.getByText('Indovinato', { exact: true })).toHaveCount(0)
  await expect(input).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Invia', exact: true })).toBeDisabled()
  await shirt.click()
  await page.keyboard.press('Enter')
  await expect(shirt.locator('.player-attempts')).toHaveText('1')
})

for (const [lastGuess, outcome] of [['AAAA', 'Rivelato'], ['ETOO', 'Indovinato']]) {
  test(`al sesto tentativo ${lastGuess} mostra Eto’o come ${outcome} e blocca ulteriori invii`, async ({ page, isMobile }) => {
    await page.goto(demoUrl)
    await page.getByRole('button', { name: 'Maglia 9, attaccante', exact: true }).click()
    const input = page.getByRole('textbox', { name: 'Il tuo tentativo' })
    const submit = page.getByRole('button', { name: 'Invia', exact: true })
    for (let attempt = 0; attempt < 5; attempt++) {
      await input.fill('ZZZZ')
      if (isMobile) await submit.tap()
      else await input.press('Enter')
    }
    await expect(input).toBeEnabled()
    await expect(page.getByRole('group', { name: 'Tentativo 5', exact: true }).getByLabel('Z: assente')).toHaveCount(4)
    await input.fill(lastGuess!)
    await submit.click()
    const shirt = page.getByRole('button', { name: `Maglia 9, Eto’o, ${outcome}` })
    await expect(shirt.locator('.player-attempts')).toHaveText('6')
    await expect(shirt.getByText(outcome!, { exact: true })).toHaveCount(0)
    await expect(input).toBeDisabled()
    await expect(submit).toBeDisabled()
    const shirt22 = page.getByRole('button', { name: 'Maglia 22, attaccante', exact: true })
    if (isMobile) await shirt22.tap()
    else await shirt22.click()
    await expect(input).toBeEnabled()
    await input.fill('milito')
    if (isMobile) await submit.tap()
    else await input.press('Enter')
    await expect(page.getByRole('button', { name: 'Maglia 22, Milito, Indovinato' })).toBeFocused()
    await shirt.click()
    await page.keyboard.press('Enter')
    await expect(shirt.locator('.player-attempts')).toHaveText('6')
    await expect(input).toBeDisabled()
  })
}

test('l’input accetta solo lettere e normalizza maiuscole, accenti e apostrofo', async ({ page }) => {
  await page.goto(demoUrl)
  await page.getByRole('button', { name: 'Maglia 9, attaccante', exact: true }).click()
  const input = page.getByRole('textbox', { name: 'Il tuo tentativo' })
  await input.fill('1234')
  await expect(input).toHaveValue('')
  await expect(page.getByRole('button', { name: 'Invia', exact: true })).toBeDisabled()
  await input.fill('éto’o')
  await expect(input).toHaveValue('ETOO')
  await input.press('Enter')
  await expect(page.getByRole('button', { name: 'Maglia 9, Eto’o, Indovinato' })).toBeVisible()
})

test('cambiare maglia conserva i tentativi e il feedback del titolare precedente', async ({ page, isMobile }) => {
  await page.goto(demoUrl)
  const shirt22 = page.getByRole('button', { name: 'Maglia 22, attaccante', exact: true })
  const shirt13 = page.getByRole('button', { name: 'Maglia 13, difensore', exact: true })
  const input = page.getByRole('textbox', { name: 'Il tuo tentativo' })
  const submit = page.getByRole('button', { name: 'Invia', exact: true })
  const first = page.getByRole('group', { name: 'Tentativo 1', exact: true })

  if (isMobile) await shirt22.tap()
  else await shirt22.click()
  await expect(first.getByLabel('Casella vuota')).toHaveCount(6)
  await input.fill('maicon')
  if (isMobile) await submit.tap()
  else await input.press('Enter')
  await expect(first.getByLabel('M: posizione corretta')).toBeVisible()
  await expect(first.getByLabel('A: assente')).toBeVisible()

  if (isMobile) await shirt13.tap()
  else await shirt13.click()
  await expect(first.getByLabel('Casella vuota')).toHaveCount(6)
  await input.fill('maicon')
  if (isMobile) await submit.tap()
  else await input.press('Enter')

  if (isMobile) await shirt22.tap()
  else await shirt22.click()
  await expect(first.getByLabel('M: posizione corretta')).toBeVisible()
  await expect(first.getByLabel('A: assente')).toBeVisible()
  await expect(input).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Maglia 13, Maicon, Indovinato' })).toBeVisible()
})

const starters = [
  { number: 12, name: 'Júlio César', answer: 'JULIOCESAR', spaceAfter: 5 },
  { number: 8, name: 'Thiago Motta', answer: 'THIAGOMOTTA', spaceAfter: 6 },
  { number: 13, name: 'Maicon', answer: 'MAICON' },
  { number: 6, name: 'Lúcio', answer: 'LUCIO' },
  { number: 25, name: 'Samuel', answer: 'SAMUEL' },
  { number: 26, name: 'Chivu', answer: 'CHIVU' },
  { number: 4, name: 'Zanetti', answer: 'ZANETTI' },
  { number: 5, name: 'Stanković', answer: 'STANKOVIC' },
  { number: 10, name: 'Sneijder', answer: 'SNEIJDER' },
  { number: 22, name: 'Milito', answer: 'MILITO' },
  { number: 9, name: 'Eto’o', answer: 'ETOO' },
]

async function playShirt(page: Page, number: number, guesses: string[]) {
  await page.getByRole('button', { name: new RegExp(`^Maglia ${number},`) }).click()
  for (const guess of guesses) {
    await page.getByRole('textbox', { name: 'Il tuo tentativo' }).fill(guess)
    await page.getByRole('button', { name: 'Invia', exact: true }).click()
  }
}

test('ricaricare ripristina la maglia in corso, gli indizi e gli esiti delle altre maglie', async ({ page }) => {
  await page.goto(demoUrl)
  await playShirt(page, 13, ['MAICON'])
  await playShirt(page, 6, Array<string>(6).fill('ZZZZZ'))
  await playShirt(page, 9, ['OTTO'])
  await page.reload()

  await expect(page.getByRole('button', { name: 'Maglia 9, attaccante', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const first = page.getByRole('group', { name: 'Tentativo 1', exact: true })
  for (const [index, label] of ['O: presente altrove', 'T: posizione corretta', 'T: assente', 'O: posizione corretta'].entries()) {
    await expect(first.getByRole('img').nth(index)).toHaveAccessibleName(label)
  }
  await expect(page.getByRole('button', { name: 'Maglia 13, Maicon, Indovinato' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Maglia 6, Lúcio, Rivelato' })).toBeVisible()

  await playShirt(page, 9, ['ETOO'])
  await expect(page.getByRole('button', { name: 'Maglia 9, Eto’o, Indovinato' }).locator('.player-attempts')).toHaveText('2')
})

test('due browser allo stesso indirizzo ritrovano ciascuno i propri tentativi', async ({ browser, page }) => {
  const other = await browser.newPage()
  try {
    await page.goto(demoUrl)
    await playShirt(page, 9, ['OTTO'])
    await other.goto(page.url())
    await expect(other.getByRole('textbox', { name: 'Il tuo tentativo' })).toBeDisabled()
    await playShirt(other, 9, ['ETOO'])

    await page.reload()
    await other.reload()
    await expect(page.getByRole('group', { name: 'Tentativo 1', exact: true }).getByLabel('T: posizione corretta')).toBeVisible()
    await expect(other.getByRole('button', { name: 'Maglia 9, Eto’o, Indovinato' })).toBeVisible()
  } finally {
    await other.close()
  }
})

test('ogni maglia mostra la propria griglia e l’ultimo titolare indovinato porta al risultato', async ({ page, isMobile }) => {
  if (isMobile) await page.setViewportSize({ width: 320, height: 640 })
  await page.goto(demoUrl)
  const input = page.getByRole('textbox', { name: 'Il tuo tentativo' })
  const submit = page.getByRole('button', { name: 'Invia', exact: true })
  const rows = page.getByRole('group', { name: /^Tentativo \d+$/ })
  const first = rows.first()

  for (const { number, name, answer, spaceAfter } of starters) {
    const shirt = page.getByRole('button', { name: new RegExp(`^Maglia ${number},`) })
    if (isMobile) await shirt.tap()
    else await shirt.click()
    await expect(shirt).toHaveAttribute('aria-pressed', 'true')
    await expect(rows).toHaveCount(6)
    await expect(first.getByRole('img', { name: 'Casella vuota' })).toHaveCount(answer.length)
    if (spaceAfter) {
      await expect(first.getByRole('img').nth(spaceAfter)).toHaveAccessibleName('Spazio')
      await expect(rows.getByRole('img', { name: 'Spazio', exact: true })).toHaveCount(6)
    }
    await input.fill(name)
    await expect(input).toHaveValue(answer)
    if (spaceAfter) {
      await expect(first.getByRole('img').nth(spaceAfter + 1)).toHaveAccessibleName(answer[spaceAfter]!)
    }
    if (number === 9) break
    if (isMobile) await submit.tap()
    else await input.press('Enter')
    await expect(first.getByRole('img', { name: /posizione corretta/ })).toHaveCount(answer.length)
    await expect(shirt).toHaveAccessibleName(`Maglia ${number}, ${name}, Indovinato`)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }

  for (const guess of ['OOOO', 'OTTO', 'ETOO']) {
    await input.fill(guess)
    if (isMobile) await submit.tap()
    else await input.press('Enter')
  }
  await expect(page.getByRole('heading', { name: 'Sfida conclusa' })).toBeFocused()
  await expect(page.getByText('11 su 11 indovinati · 13 tentativi', { exact: true })).toBeVisible()
  await expect(page.locator('.player-attempts')).toHaveCount(11)
  const etoo = page.locator('.player').filter({ has: page.getByText('Eto’o', { exact: true }) })
  await expect(etoo.locator('.player-attempts')).toHaveText('3')
  await expect(page.getByRole('img', { name: 'Marcatore' })).toHaveCount(4)
  const pitch = page.locator('.pitch')
  await expect(pitch.getByText(/^(Indovinato|Rivelato)$/)).toHaveCount(0)
  expect(await pitch.evaluate(field => {
    const bounds = field.getBoundingClientRect()
    return Array.from(field.querySelectorAll('.player-caption, .scorer-icon')).every(element => {
      const { left, right } = element.getBoundingClientRect()
      return left >= bounds.left && right <= bounds.right
    })
  })).toBe(true)
  await expect(page.getByRole('button', { name: /^Maglia / })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('annullare Termina conserva i tentativi e confermare salva il risultato con i quattro titolari rivelati', async ({ page, context, isMobile }) => {
  await page.goto(demoUrl)
  const panel = page.getByRole('region', { name: 'Tentativi', exact: true })
  const input = panel.getByRole('textbox', { name: 'Il tuo tentativo' })
  const submit = panel.getByRole('button', { name: 'Invia', exact: true })
  const conclude = panel.getByRole('button', { name: 'Termina', exact: true })
  const dialog = page.getByRole('dialog', { name: 'Vuoi rivelare i 4 titolari rimasti?' })
  const cancel = dialog.getByRole('button', { name: 'Continua a giocare' })
  const confirm = dialog.getByRole('button', { name: 'Rivela e concludi' })

  for (const { number, answer } of starters.slice(0, 7)) {
    await playShirt(page, number, [answer])
  }
  await playShirt(page, 9, Array<string>(5).fill('ZZZZ'))
  await playShirt(page, 22, Array<string>(5).fill('ZZZZZZ'))
  await playShirt(page, 10, ['ZZZZZZZZ', 'ZZZZZZZZ'])

  await expect(conclude).toBeVisible()
  if (isMobile) await conclude.tap()
  else await conclude.click()
  await expect(dialog).toBeVisible()
  await expect(cancel).toBeFocused()
  if (isMobile) await cancel.tap()
  else await page.keyboard.press('Enter')
  await expect(dialog).toBeHidden()
  await expect(conclude).toBeFocused()
  await expect(page.getByRole('group', { name: 'Tentativo 2', exact: true }).getByLabel('Z: assente')).toHaveCount(8)

  await input.fill('ZZZZZZZZ')
  await submit.click()
  await conclude.click()
  if (isMobile) await confirm.tap()
  else await confirm.click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('heading', { name: 'Sfida conclusa' })).toBeFocused()
  await expect(page.getByText('7 su 11 indovinati · 20 tentativi', { exact: true })).toBeVisible()
  await expect(page.locator('.player-attempts')).toHaveCount(11)
  await expect(page.locator('.pitch').getByText(/^(Indovinato|Rivelato)$/)).toHaveCount(0)
  const stankovic = page.locator('.player').filter({ has: page.getByText('Stanković', { exact: true }) })
  await expect(stankovic.locator('.player-attempts')).toHaveText('0')
  const milito = page.locator('.player').filter({ has: page.getByText('Milito', { exact: true }) })
  await expect(milito.locator('.player-attempts')).toHaveText('5')
  for (const { name } of starters) await expect(page.getByText(name, { exact: true })).toBeVisible()
  await expect(input).toHaveCount(0)
  await expect(conclude).toHaveCount(0)

  await page.close()
  const reopened = await context.newPage()
  await reopened.goto(demoUrl)
  await expect(reopened.getByRole('heading', { name: 'Sfida conclusa' })).toBeVisible()
  await expect(reopened.getByText('7 su 11 indovinati · 20 tentativi', { exact: true })).toBeVisible()
  const restored = reopened.locator('.player').filter({ has: reopened.getByText('Stanković', { exact: true }) })
  await expect(restored.locator('.player-attempts')).toHaveText('0')
  await expect(reopened.getByRole('button')).toHaveCount(0)
})

test('il sesto errore sull’ultima maglia conclude la sfida e il risultato resta dopo la ricarica', async ({ page }) => {
  await page.goto(demoUrl)
  for (const { number, answer } of starters.slice(0, -1)) {
    await playShirt(page, number, [answer])
  }
  await playShirt(page, 9, Array<string>(5).fill('ZZZZ'))
  await expect(page.getByRole('group', { name: 'Tentativo 5', exact: true }).getByLabel('Z: assente')).toHaveCount(4)
  const conclude = page.getByRole('button', { name: 'Termina', exact: true })
  const dialog = page.getByRole('dialog', { name: 'Vuoi rivelare 1 titolare rimasto?' })
  await expect(page.getByRole('textbox', { name: 'Il tuo tentativo' })).toBeFocused()
  await conclude.dispatchEvent('click')
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(conclude).toBeFocused()

  await playShirt(page, 9, ['ZZZZ'])
  await expect(page.getByText('10 su 11 indovinati · 16 tentativi', { exact: true })).toBeVisible()
  const etoo = page.locator('.player').filter({ has: page.getByText('Eto’o', { exact: true }) })
  await expect(etoo.locator('.player-attempts')).toHaveText('6')

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Sfida conclusa' })).toBeVisible()
  await expect(page.getByText('10 su 11 indovinati · 16 tentativi', { exact: true })).toBeVisible()
  await expect(etoo.locator('.player-attempts')).toHaveText('6')
  await expect(page.getByRole('button')).toHaveCount(0)
})

test('una scheda già aperta mostra l’esito salvato della maglia o della sfida', async ({ context, page }) => {
  await page.goto(demoUrl)
  const other = await context.newPage()
  await other.goto(demoUrl)
  await playShirt(page, 9, ['ETOO'])
  await playShirt(other, 9, ['OTTO'])
  await expect(other.getByRole('button', { name: 'Maglia 9, Eto’o, Indovinato' })).toBeFocused()

  await page.getByRole('button', { name: 'Termina', exact: true }).click()
  await page.getByRole('button', { name: 'Rivela e concludi' }).click()

  await playShirt(other, 22, ['MILITO'])
  await expect(other.getByRole('heading', { name: 'Sfida conclusa' })).toBeFocused()
  await expect(other.getByText('1 su 11 indovinati · 1 tentativo', { exact: true })).toBeVisible()
  await other.reload()
  await expect(other.getByText('1 su 11 indovinati · 1 tentativo', { exact: true })).toBeVisible()
})
