import playerNameOverrides from './strikerapi-name-overrides.json'
import teamShirtOverrides from './team-shirt-overrides.json'

export interface StrikerTeam {
  team_id: string
  name: string
  score: number
}

export interface StrikerMatch {
  game: {
    game_id: string
    date: string
    home: StrikerTeam
    away: StrikerTeam
  }
  lineups: {
    team_id: string
    formation: string
    starting_xi: {
      player_id: string
      name: string
      jersey: string
      formation_place: number | null
      position?: string | null
      goals: number
    }[]
  }[]
}

type Starter = StrikerMatch['lineups'][number]['starting_xi'][number]

const positions = [
  /\bgoalkeeper\b/i,
  /\b(back|defender|sweeper)\b/i,
  /\b(defensive|holding) midfielder\b/i,
  /\battacking midfielder\b/i,
  /\bmidfielder\b/i,
  /\b(forward|striker|winger)\b/i,
]

function positionOrder(position: string) {
  const role = positions.findIndex(pattern => pattern.test(position))
  if (role < 0) return -1
  const row = role === 3 ? 4 : role === 4 ? 3 : role
  const side = /\bleft\b/i.test(position) ? 0 : /\bright\b/i.test(position) ? 2 : 1
  return row * 3 + side
}

export function orderStarters(starters: StrikerMatch['lineups'][number]['starting_xi']) {
  const order = new Map(starters.map(player => [player, positionOrder(player.position ?? '')]))
  if ([...order.values()].every(value => value >= 0)) {
    return [...starters].sort((a, b) => order.get(a)! - order.get(b)!)
  }
  return [...starters].sort((a, b) => (a.formation_place ?? 0) - (b.formation_place ?? 0))
}

export const strikerMatches = Object.values(import.meta.glob<{ data: StrikerMatch }>('./strikerapi/*.json', {
  eager: true,
  import: 'default',
})).map(({ data }) => data)

interface ShirtPalette {
  color: string
  text_color?: string
  accent_color?: string
  pattern?: string
  band_colors?: string[]
}

const importedTeamColors = import.meta.glob<ShirtPalette & { team_id: string }>(
  './strikerapi/team-colors/*.json',
  { eager: true, import: 'default' },
)

export const teamColors = new Map<string, ShirtPalette>([
  ...Object.values(importedTeamColors).map(palette => [palette.team_id, palette] as const),
  ...Object.entries(teamShirtOverrides),
])

const shortNames = new Map(Object.values(import.meta.glob<{ player_id: string; short_name: string }>(
  './strikerapi/short-names/*.json',
  { eager: true, import: 'default' },
)).map(({ player_id, short_name }) => [player_id, short_name]))

const nameOverrides = new Map<string, { name: string; team_id?: string }>(Object.entries(playerNameOverrides))

export function quizPlayerName(teamId: string, player: Starter) {
  const playerId = String(player.player_id)
  const override = nameOverrides.get(playerId)
  if (override && (override.team_id === undefined || override.team_id === teamId)) return override.name

  return shortNames.get(playerId)?.replace(/^\p{L}\p{M}*\.\s+/u, '') || player.name
}
