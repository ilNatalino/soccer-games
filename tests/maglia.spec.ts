import { expect, test } from '@playwright/test'

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

test('ogni titolare ha sei righe e i nomi composti hanno uno spazio fisso', async ({ page, isMobile }) => {
  if (isMobile) await page.setViewportSize({ width: 320, height: 640 })
  await page.goto('/')
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
    if (isMobile) await submit.tap()
    else await input.press('Enter')
    await expect(first.getByRole('img', { name: /posizione corretta/ })).toHaveCount(answer.length)
    await expect(page.getByRole('status')).toContainText(`${name} · Indovinato`)
    await expect(shirt).toHaveAccessibleName(`Maglia ${number}, ${name}, Indovinato`)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
})
