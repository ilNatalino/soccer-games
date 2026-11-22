<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import Game from './Game.vue'
import { derby } from './derby'
import schedule from './calendar.json'
import { strikerMatches } from './strikerapi'
import './style.css'

const timeZone = 'Europe/Rome'
const romeDate = new Intl.DateTimeFormat('en-GB', {
  timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
})
const romeOffset = new Intl.DateTimeFormat('en-GB', { timeZone, timeZoneName: 'longOffset' })
const dayLabel = new Intl.DateTimeFormat('it-IT', {
  timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short',
})
const queries = new URLSearchParams(window.location.search)
const isDemo = queries.get('partita') === 'demo'
const requestedDate = queries.get('giorno')
const matchIds: Readonly<Partial<Record<string, string>>> = schedule
const matches = new Map(strikerMatches.map(match => [match.game.game_id, match]))
const today = ref(dateInRome(new Date()))
const days = computed(() => Array.from({ length: 8 }, (_, offset) => shiftDate(today.value, -offset)))
const selectedDate = computed(() => requestedDate && days.value.includes(requestedDate) ? requestedDate : today.value)
const match = computed(() => {
  if (isDemo) return derby
  const gameId = matchIds[selectedDate.value]
  return gameId === undefined ? undefined : matches.get(gameId)
})

let midnightTimer: number | undefined

function dateInRome(date: Date) {
  const { year, month, day } = Object.fromEntries(romeDate.formatToParts(date).map(({ type, value }) => [type, value]))
  return `${year}-${month}-${day}`
}

function shiftDate(date: string, days: number) {
  const utc = new Date(`${date}T00:00:00Z`)
  utc.setUTCDate(utc.getUTCDate() + days)
  return utc.toISOString().slice(0, 10)
}

function refreshToday() {
  window.clearTimeout(midnightTimer)
  const now = new Date()
  today.value = dateInRome(now)
  const nextDayStart = `${shiftDate(today.value, 1)}T00:00:00`
  const offset = romeOffset.formatToParts(new Date(`${nextDayStart}Z`))
    .find(({ type }) => type === 'timeZoneName')!.value.slice(3)
  const nextMidnight = Date.parse(`${nextDayStart}${offset}`)
  midnightTimer = window.setTimeout(refreshToday, nextMidnight - now.getTime())
}

onMounted(() => {
  if (isDemo) return
  refreshToday()
  window.addEventListener('pageshow', refreshToday)
  document.addEventListener('visibilitychange', refreshToday)
})

onUnmounted(() => {
  window.clearTimeout(midnightTimer)
  window.removeEventListener('pageshow', refreshToday)
  document.removeEventListener('visibilitychange', refreshToday)
})
</script>

<template>
  <header class="masthead">
    <a href="/" class="wordmark" aria-label="Missing XI, inizio">MISSING <b>XI</b></a>
    <span>Il calcio, a memoria.</span>
  </header>

  <main>
    <nav v-if="!isDemo" class="challenge-picker" aria-label="Calendario delle sfide">
      <a
        v-for="date in days"
        :key="date"
        :href="date === today ? '/' : `?giorno=${date}`"
        :aria-current="date === selectedDate ? 'page' : undefined"
      >
        <time :datetime="date">{{ date === today ? 'Oggi' : dayLabel.format(new Date(date)) }}</time>
      </a>
    </nav>

    <Game v-if="match" :key="selectedDate" :match="match" />
    <h1 v-else class="challenge-unavailable">Sfida non disponibile</h1>
  </main>
</template>
