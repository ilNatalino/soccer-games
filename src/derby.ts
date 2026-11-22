import type { StrikerMatch } from './strikerapi'

// Esempio locale nel formato StrikerAPI, trascritto da https://www.inter.it/it/match_center/3777
export const derby: StrikerMatch = {
  game: {
    game_id: 'demo',
    date: '2009-08-29',
    home: { team_id: 'milan', name: 'Milan', score: 0 },
    away: { team_id: 'inter', name: 'Inter', score: 4 },
  },
  lineups: [{
    team_id: 'inter',
    formation: '4-3-1-2',
    starting_xi: [
      { player_id: '12', name: 'Júlio César', jersey: '12', formation_place: 1, goals: 0 },
      { player_id: '13', name: 'Maicon', jersey: '13', formation_place: 2, goals: 1 },
      { player_id: '6', name: 'Lúcio', jersey: '6', formation_place: 3, goals: 0 },
      { player_id: '25', name: 'Samuel', jersey: '25', formation_place: 4, goals: 0 },
      { player_id: '26', name: 'Chivu', jersey: '26', formation_place: 5, goals: 0 },
      { player_id: '4', name: 'Zanetti', jersey: '4', formation_place: 6, goals: 0 },
      { player_id: '5', name: 'Stanković', jersey: '5', formation_place: 7, goals: 1 },
      { player_id: '8', name: 'Thiago Motta', jersey: '8', formation_place: 8, goals: 1 },
      { player_id: '10', name: 'Sneijder', jersey: '10', formation_place: 9, goals: 0 },
      { player_id: '22', name: 'Milito', jersey: '22', formation_place: 10, goals: 1 },
      { player_id: '9', name: 'Eto’o', jersey: '9', formation_place: 11, goals: 0 },
    ],
  }],
}
