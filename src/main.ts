import { createApp } from 'vue'
import App from './App.vue'
import { derby } from './derby'
import { strikerMatches } from './strikerapi'

const gameId = new URLSearchParams(window.location.search).get('partita')
const matches = [...strikerMatches].sort((a, b) => a.game.date.localeCompare(b.game.date))
const match = gameId === 'demo'
  ? derby
  : matches.find(({ game }) => game.game_id === gameId) ?? matches[0] ?? derby

createApp(App, { match, matches }).mount('#app')
