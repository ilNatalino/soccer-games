import { expect, test } from '@playwright/test'
import { derby } from '../src/derby'
import palettes from '../src/team-shirt-overrides.json' with { type: 'json' }

function rgb(hex: string) {
  const channels = hex.slice(1).match(/.{2}/g)!.map(channel => Number.parseInt(channel, 16))
  return `rgb(${channels.join(', ')})`
}

test('applica i colori personalizzati e distingue la maglia del portiere', async ({ page }) => {
  test.setTimeout(60_000)
  let teamId = '103'
  await page.route(url => url.pathname === '/src/derby.ts', route => route.fulfill({
    contentType: 'text/javascript',
    body: `export const derby = ${JSON.stringify({
      game: { ...derby.game, away: { ...derby.game.away, team_id: teamId } },
      lineups: [{ ...derby.lineups[0], team_id: teamId }],
    })}`,
  }))

  for (const [id, palette] of Object.entries(palettes)) {
    teamId = id
    await page.goto('/?partita=demo')
    const shirt = page.getByRole('button', { name: /^Maglia 9,/ }).locator('.shirt')
    await expect(shirt).toHaveCSS('background-color', rgb(palette.color))
    await expect(shirt).toHaveCSS('color', rgb(palette.text_color))

    if ('pattern' in palette) {
      await expect(shirt).toHaveAttribute('data-pattern', palette.pattern)
      const background = await shirt.evaluate(element => getComputedStyle(element).backgroundImage)
      expect(background).toContain(rgb(palette.accent_color))
      if ('band_colors' in palette) {
        for (const color of palette.band_colors) expect(background).toContain(rgb(color))
      }
    } else {
      await expect(shirt).toHaveCSS('background-image', 'none')
    }

    const goalkeeper = page.getByRole('button', { name: /^Maglia 12,/ }).locator('.shirt')
    await expect(goalkeeper).toHaveCSS('background-color', rgb('#D4A83A'))
    await expect(goalkeeper).toHaveCSS('background-image', 'none')
  }
})
