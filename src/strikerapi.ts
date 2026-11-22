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
