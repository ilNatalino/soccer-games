import { expect, test, type Page } from '@playwright/test'

test('il derby mostra undici maglie e permette di aprire la numero 9', async ({ page, isMobile }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Milan 0–4 Inter' })).toBeVisible()
  await expect(page.getByText('29 agosto 2009')).toBeVisible()
  await expect(page.getByText('4-3-1-2', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Maglia / })).toHaveCount(11)

  const shirt = page.getByRole('button', { name: 'Maglia 9, attaccante', exact: true })
  if (isMobile) await shirt.tap()
  else await shirt.click()

  await expect(page.getByRole('heading', { name: 'Maglia 9' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Il tuo tentativo' })).toBeFocused()
  await expect(page.getByRole('button', { name: 'Invia tentativo' })).toBeDisabled()
  const row = page.getByRole('group', { name: 'Tentativo 1', exact: true })
  await expect(row.getByLabel('Casella vuota')).toHaveCount(4)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('si corregge una riga prima di inviarla e le O duplicate ricevono il feedback Wordle', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Maglia 9, attaccante', exact: true }).click()
  const input = page.getByRole('textbox', { name: 'Il tuo tentativo' })
  const submit = page.getByRole('button', { name: 'Invia tentativo' })
  await input.pressSequentially('oo')
  await expect(submit).toBeDisabled()
  await input.press('Enter')
  await expect(page.getByText('0 di 6 tentativi inviati')).toBeVisible()
  await input.press('Backspace')
  await input.pressSequentially('ooo')
  await expect(input).toHaveValue('OOOO')
  await expect(submit).toBeEnabled()
  await input.press('Enter')

  const first = page.getByRole('group', { name: 'Tentativo 1', exact: true })
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
  await expect(page.getByText('2 di 6 tentativi inviati')).toBeVisible()
})

test('si sceglie con la tastiera e ETOO chiude la maglia come indovinata', async ({ page }) => {
  await page.goto('/')
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

  await expect(page.getByRole('status')).toContainText('Eto’o · Indovinato')
  await expect(page.getByRole('button', { name: 'Maglia 9, Eto’o, Indovinato' })).toBeVisible()
  await expect(input).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Invia tentativo' })).toBeDisabled()
  await page.getByRole('button', { name: 'Maglia 9, Eto’o, Indovinato' }).click()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status')).toContainText('1 di 6 tentativi inviati')
})

for (const [lastGuess, outcome] of [['AAAA', 'Rivelato'], ['ETOO', 'Indovinato']]) {
  test(`al sesto tentativo ${lastGuess} mostra Eto’o come ${outcome} e blocca ulteriori invii`, async ({ page, isMobile }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Maglia 9, attaccante', exact: true }).click()
    const input = page.getByRole('textbox', { name: 'Il tuo tentativo' })
    const submit = page.getByRole('button', { name: 'Invia tentativo' })
    for (let attempt = 0; attempt < 5; attempt++) {
      await input.fill('ZZZZ')
      if (isMobile) await submit.tap()
      else await input.press('Enter')
    }
    await expect(input).toBeEnabled()
    await expect(page.getByRole('status')).toHaveText('5 di 6 tentativi inviati')
    await input.fill(lastGuess!)
    await submit.click()
    await expect(page.getByRole('status')).toContainText(`Eto’o · ${outcome}`)
    await expect(page.getByRole('button', { name: `Maglia 9, Eto’o, ${outcome}` })).toBeVisible()
    await expect(input).toBeDisabled()
    await expect(submit).toBeDisabled()
    const shirt22 = page.getByRole('button', { name: 'Maglia 22, attaccante', exact: true })
    if (isMobile) await shirt22.tap()
    else await shirt22.click()
    await expect(input).toBeEnabled()
    await input.fill('milito')
    if (isMobile) await submit.tap()
    else await input.press('Enter')
    await expect(page.getByRole('status')).toContainText('Milito · Indovinato')
    await page.getByRole('button', { name: `Maglia 9, Eto’o, ${outcome}` }).click()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('status')).toContainText('6 di 6 tentativi inviati')
    await expect(input).toBeDisabled()
  })
}

test('l’input accetta solo lettere e normalizza maiuscole, accenti e apostrofo', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Maglia 9, attaccante', exact: true }).click()
  const input = page.getByRole('textbox', { name: 'Il tuo tentativo' })
  await input.fill('1234')
  await expect(input).toHaveValue('')
  await expect(page.getByRole('button', { name: 'Invia tentativo' })).toBeDisabled()
  await input.fill('éto’o')
  await expect(input).toHaveValue('ETOO')
  await input.press('Enter')
  await expect(page.getByRole('status')).toContainText('Eto’o · Indovinato')
})

test('cambiare maglia conserva i tentativi e il feedback del titolare precedente', async ({ page, isMobile }) => {
  await page.goto('/')
  const shirt22 = page.getByRole('button', { name: 'Maglia 22, attaccante', exact: true })
  const shirt13 = page.getByRole('button', { name: 'Maglia 13, difensore', exact: true })
  const input = page.getByRole('textbox', { name: 'Il tuo tentativo' })
  const submit = page.getByRole('button', { name: 'Invia tentativo' })
  const first = page.getByRole('group', { name: 'Tentativo 1', exact: true })

  if (isMobile) await shirt22.tap()
  else await shirt22.click()
  await expect(first.getByLabel('Casella vuota')).toHaveCount(6)
  await input.fill('maicon')
  if (isMobile) await submit.tap()
  else await input.press('Enter')
  await expect(page.getByRole('status')).toHaveText('1 di 6 tentativi inviati')
  await expect(first.getByLabel('M: posizione corretta')).toBeVisible()
  await expect(first.getByLabel('A: assente')).toBeVisible()

  if (isMobile) await shirt13.tap()
  else await shirt13.click()
  await expect(page.getByRole('status')).toHaveText('0 di 6 tentativi inviati')
  await expect(first.getByLabel('Casella vuota')).toHaveCount(6)
  await input.fill('maicon')
  if (isMobile) await submit.tap()
  else await input.press('Enter')
  await expect(page.getByRole('status')).toContainText('Maicon · Indovinato')

  if (isMobile) await shirt22.tap()
  else await shirt22.click()
  await expect(page.getByRole('status')).toHaveText('1 di 6 tentativi inviati')
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
    await page.getByRole('button', { name: 'Invia tentativo' }).click()
  }
}

test('ogni maglia mostra la propria griglia e l’ultimo titolare indovinato porta al risultato', async ({ page, isMobile }) => {
  if (isMobile) await page.setViewportSize({ width: 320, height: 640 })
  await page.goto('/')
  const input = page.getByRole('textbox', { name: 'Il tuo tentativo' })
  const submit = page.getByRole('button', { name: 'Invia tentativo' })
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
    await expect(page.getByRole('status')).toHaveText('0 di 6 tentativi inviati')
    await input.fill(name)
    await expect(input).toHaveValue(answer)
    if (spaceAfter) {
      await expect(first.getByRole('img').nth(spaceAfter + 1)).toHaveAccessibleName(answer[spaceAfter]!)
    }
    if (number === 9) break
    if (isMobile) await submit.tap()
    else await input.press('Enter')
    await expect(first.getByRole('img', { name: /posizione corretta/ })).toHaveCount(answer.length)
    await expect(page.getByRole('status')).toContainText(`${name} · Indovinato`)
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
  await expect(page.getByText('Indovinato', { exact: true })).toHaveCount(11)
  await expect(page.getByRole('button', { name: /^Maglia / })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('annullare Concludi conserva i tentativi e confermare rivela i quattro titolari rimasti', async ({ page, isMobile }) => {
  await page.goto('/')
  const input = page.getByRole('textbox', { name: 'Il tuo tentativo' })
  const submit = page.getByRole('button', { name: 'Invia tentativo' })
  const conclude = page.getByRole('button', { name: 'Concludi', exact: true })
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
  await expect(page.getByRole('status')).toHaveText('2 di 6 tentativi inviati')
  await expect(page.getByRole('group', { name: 'Tentativo 1', exact: true }).getByLabel('Z: assente').first()).toBeVisible()

  await input.fill('ZZZZZZZZ')
  await submit.click()
  await conclude.click()
  if (isMobile) await confirm.tap()
  else await confirm.click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('heading', { name: 'Sfida conclusa' })).toBeFocused()
  await expect(page.getByText('7 su 11 indovinati · 20 tentativi', { exact: true })).toBeVisible()
  await expect(page.getByText(/\btentativ[oi]\b/)).toHaveCount(1)
  await expect(page.getByText('Indovinato', { exact: true })).toHaveCount(7)
  await expect(page.getByText('Rivelato', { exact: true })).toHaveCount(4)
  for (const { name } of starters) await expect(page.getByText(name, { exact: true })).toBeVisible()
  await expect(input).toHaveCount(0)
  await expect(conclude).toHaveCount(0)
})

test('il sesto errore sull’ultima maglia conclude automaticamente la sfida', async ({ page }) => {
  await page.goto('/')
  for (const { number, answer } of starters.slice(0, -1)) {
    await playShirt(page, number, [answer])
  }
  await playShirt(page, 9, Array<string>(5).fill('ZZZZ'))
  await expect(page.getByRole('status')).toHaveText('5 di 6 tentativi inviati')
  const conclude = page.getByRole('button', { name: 'Concludi', exact: true })
  const dialog = page.getByRole('dialog', { name: 'Vuoi rivelare 1 titolare rimasto?' })
  await expect(page.getByRole('textbox', { name: 'Il tuo tentativo' })).toBeFocused()
  await conclude.dispatchEvent('click')
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(conclude).toBeFocused()

  await playShirt(page, 9, ['ZZZZ'])
  await expect(page.getByText('10 su 11 indovinati · 16 tentativi', { exact: true })).toBeVisible()
  await expect(page.getByText('Indovinato', { exact: true })).toHaveCount(10)
  await expect(page.getByText('Rivelato', { exact: true })).toBeVisible()
})
