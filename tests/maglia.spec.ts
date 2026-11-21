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
    await page.getByRole('button', { name: 'Maglia 22, attaccante', exact: true }).click()
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
