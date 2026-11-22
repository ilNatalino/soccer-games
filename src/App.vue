<script setup lang="ts">
import { computed, nextTick, reactive, ref, useTemplateRef } from 'vue'
import { orderStarters, type StrikerMatch } from './strikerapi'
import { evaluateGuess } from './wordle'
import './style.css'

const { match, matches } = defineProps<{ match: StrikerMatch; matches: StrikerMatch[] }>()
const { game } = match
const formation = match.lineups.find(team => team.team_id === game.away.team_id)!
const isDemo = game.game_id === 'demo'
const dateLabel = new Intl.DateTimeFormat('it-IT', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(game.date))
const maxAttempts = 6
const progressKey = isDemo
  ? `missing-xi:${game.date}:${game.away.name}:v1`
  : `missing-xi:strikerapi:${game.game_id}:${game.away.team_id}:v1`
const endedEarly = ref(false)
const starters = orderStarters(formation.starting_xi)
let offset = 0
const lineup = reactive([1, ...formation.formation.split('-').map(Number)].map((size, row, rows) => {
  const players = starters.slice(offset, offset + size).map(player => {
    const pattern = player.name.trim().split(/\s+/).map(letters).join(' ')
    return {
      player,
      pattern,
      answer: pattern.replaceAll(' ', ''),
      draft: '',
      attempts: [] as string[],
      get outcome(): 'Indovinato' | 'Rivelato' | '' {
        if (this.attempts.includes(this.answer)) return 'Indovinato'
        return endedEarly.value || this.attempts.length === maxAttempts ? 'Rivelato' : ''
      },
    }
  })
  offset += size
  const role = row === 0 ? 'portiere'
    : row === 1 ? 'difensore'
      : row === rows.length - 1 ? 'attaccante'
        : row === rows.length - 2 && size === 1 ? 'trequartista' : 'centrocampista'
  return { role, row, players }
}).reverse())
type Shirt = (typeof lineup)[number]['players'][number]

const shirts = lineup.flatMap(line => line.players)
const remaining = computed(() => shirts.filter(shirt => !shirt.outcome).length)
const finished = computed(() => remaining.value === 0)
const guessedCount = computed(() => shirts.filter(shirt => shirt.outcome === 'Indovinato').length)
const totalAttempts = computed(() => shirts.reduce((total, shirt) => total + shirt.attempts.length, 0))

let lastSnapshot: string | null = null
const selected = ref<Shirt | null>(restoreProgress() ?? null)
const guessInput = useTemplateRef<HTMLInputElement>('guessInput')
const pitch = useTemplateRef<HTMLDivElement>('pitch')
const finishDialog = useTemplateRef<HTMLDialogElement>('finishDialog')
const scoreHeading = useTemplateRef<HTMLHeadingElement>('scoreHeading')
const rows = computed(() => {
  const shirt = selected.value
  if (!shirt) return []
  let letterIndex = 0
  const positions = Array.from(shirt.pattern, character => character === ' ' ? null : letterIndex++)
  return Array.from({ length: maxAttempts }, (_, row) => {
    const attempt = shirt.attempts[row]
    const feedback = attempt ? evaluateGuess(shirt.answer, attempt) : []
    const text = attempt ?? (row === shirt.attempts.length ? shirt.draft : '')
    return positions.map(cell => cell === null ? null : { letter: text[cell], feedback: feedback[cell] })
  })
})
const canSubmit = computed(() => {
  const shirt = selected.value
  return Boolean(shirt && !shirt.outcome && shirt.draft.length === shirt.answer.length)
})
const feedbackLabels = { correct: 'posizione corretta', present: 'presente altrove', absent: 'assente' }
const feedbackSymbols = { correct: '✓', present: '↔', absent: '×' }

function letters(text: string) {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().replace(/[^A-Z]/g, '')
}

function attemptLabel(count: number) {
  return `${count} ${count === 1 ? 'tentativo' : 'tentativi'}`
}

function shirtDescription(shirt: Shirt) {
  const details = []
  if (shirt.player.goals > 0) details.push('Marcatore')
  if (shirt.outcome) details.push(attemptLabel(shirt.attempts.length))
  return details.join(', ') || undefined
}

function restoreProgress() {
  try {
    const snapshot = localStorage.getItem(progressKey)
    if (snapshot === null || snapshot === lastSnapshot) return
    const saved: unknown = JSON.parse(snapshot)
    if (!saved || typeof saved !== 'object' || !('attempts' in saved)) return
    if (!('endedEarly' in saved) || typeof saved.endedEarly !== 'boolean') return
    const byNumber = saved.attempts
    if (!byNumber || typeof byNumber !== 'object' || Array.isArray(byNumber)) return

    const restored = shirts.map(shirt => {
      const guesses = (byNumber as Record<string, unknown>)[shirt.player.jersey]
      if (!Array.isArray(guesses) || guesses.length > maxAttempts) return
      if (guesses.every((guess: unknown, index): guess is string => typeof guess === 'string'
        && guess.length === shirt.answer.length && letters(guess) === guess
        && (guess !== shirt.answer || index === guesses.length - 1))) return { shirt, guesses }
    })
    if (!restored.every(entry => entry !== undefined)) return

    for (const { shirt, guesses } of restored) shirt.attempts = guesses
    endedEarly.value = saved.endedEarly
    lastSnapshot = snapshot
    if ('selectedNumber' in saved) return shirts.find(shirt => shirt.player.jersey === String(saved.selectedNumber))
  } catch {
    // Unavailable storage or an unreadable save should still let the page open.
  }
}

function saveProgress() {
  try {
    const snapshot = JSON.stringify({
      endedEarly: endedEarly.value,
      selectedNumber: selected.value?.player.jersey ?? null,
      attempts: Object.fromEntries(shirts.map(shirt => [shirt.player.jersey, shirt.attempts])),
    })
    // shortcut: tabs can race between read and write, use transactional storage if supporting simultaneous play.
    localStorage.setItem(progressKey, snapshot)
    lastSnapshot = snapshot
  } catch {
    // Let the current game continue if the browser blocks storage or runs out of space.
  }
}

function editGuess(event: Event) {
  const shirt = selected.value
  if (!shirt) return
  const input = event.target as HTMLInputElement
  const cursor = letters(input.value.slice(0, input.selectionStart ?? input.value.length)).length
  shirt.draft = letters(input.value).slice(0, shirt.answer.length)
  input.value = shirt.draft
  input.setSelectionRange(cursor, cursor)
}

async function focusGame() {
  await nextTick()
  if (finished.value) scoreHeading.value?.focus()
  else if (selected.value?.outcome) pitch.value?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.focus()
  else guessInput.value?.focus()
}

function submitGuess() {
  restoreProgress()
  const shirt = selected.value
  if (finished.value || shirt?.outcome) return focusGame()
  if (!shirt || !canSubmit.value) return
  shirt.attempts.push(shirt.draft)
  shirt.draft = ''
  saveProgress()
  return focusGame()
}

function selectShirt(shirt: Shirt) {
  selected.value = shirt
  return focusGame()
}

function openFinishDialog(event: MouseEvent) {
  const trigger = event.currentTarget as HTMLButtonElement
  trigger.focus()
  finishDialog.value?.showModal()
}

function finishEarly() {
  finishDialog.value?.close()
  restoreProgress()
  if (!finished.value) {
    endedEarly.value = true
    saveProgress()
  }
  return focusGame()
}
</script>

<template>
  <header class="masthead">
    <a href="/" class="wordmark" aria-label="Missing XI, inizio">MISSING <b>XI</b></a>
    <span>Il calcio, a memoria.</span>
  </header>

  <main>
    <section class="match" aria-labelledby="match-title">
      <p class="eyebrow">{{ isDemo ? 'Serie A · Il derby di Milano' : 'Serie A' }}</p>
      <div class="match-heading">
        <h1 id="match-title">{{ game.home.name }} <strong>{{ game.home.score }}–{{ game.away.score }}</strong> {{ game.away.name }}</h1>
        <time :datetime="game.date">{{ dateLabel }}</time>
      </div>
      <p v-if="isDemo">Una notte da ricordare. Ma ricordi chi era in campo?</p>
    </section>

    <nav v-if="!isDemo && matches.length > 1" class="match-picker" aria-label="Partite">
      <a
        v-for="entry in matches"
        :key="entry.game.game_id"
        :href="`?partita=${encodeURIComponent(entry.game.game_id)}`"
        :aria-current="entry.game.game_id === game.game_id ? 'page' : undefined"
      >{{ entry.game.home.name }}–{{ entry.game.away.name }} ({{ entry.game.date.slice(0, 4) }})</a>
    </nav>

    <div class="game-layout" :class="{ finished }">
      <section class="formation" aria-labelledby="formation-title">
        <div v-if="finished" class="challenge-result">
          <h2 ref="scoreHeading" tabindex="-1" aria-describedby="challenge-score">Sfida conclusa</h2>
          <p id="challenge-score">{{ guessedCount }} su {{ shirts.length }} indovinati · {{ attemptLabel(totalAttempts) }}</p>
        </div>
        <div class="section-heading">
          <h2 id="formation-title">{{ game.away.name }}</h2>
          <span>{{ formation.formation }}</span>
        </div>
        <div ref="pitch" class="pitch">
          <div class="pitch-markings" aria-hidden="true"><i></i></div>
          <div v-for="line in lineup" :key="line.row" class="pitch-row" :style="{ '--shirts-in-row': line.players.length }">
            <component
              v-for="shirt in line.players"
              :key="shirt.player.player_id"
              :is="finished ? 'div' : 'button'"
              :type="finished ? undefined : 'button'"
              class="player"
              :class="{ selected: !finished && selected === shirt, resolved: shirt.outcome }"
              :aria-label="finished ? undefined : (shirt.outcome ? `Maglia ${shirt.player.jersey}, ${shirt.player.name}, ${shirt.outcome}` : `Maglia ${shirt.player.jersey}, ${line.role}`)"
              :aria-description="finished ? undefined : shirtDescription(shirt)"
              :aria-pressed="finished ? undefined : selected === shirt"
              :aria-controls="finished ? undefined : 'guess-panel'"
              @click="!finished && selectShirt(shirt)"
            >
              <span class="shirt-icon">
                <span class="shirt" :class="{ goalkeeper: line.role === 'portiere' }" :aria-hidden="!finished">{{ shirt.player.jersey }}</span>
                <span v-if="shirt.player.goals > 0" class="scorer-icon" role="img" aria-label="Marcatore" :aria-hidden="!finished">⚽</span>
              </span>
              <span class="player-caption">
                <span>{{ shirt.outcome ? shirt.player.name : '· · ·' }}</span>
                <span v-if="shirt.outcome" class="player-attempts" :title="attemptLabel(shirt.attempts.length)" aria-hidden="true">{{ shirt.attempts.length }}</span>
                <span v-if="finished" class="visually-hidden">{{ attemptLabel(shirt.attempts.length) }}</span>
              </span>
            </component>
          </div>
        </div>
        <template v-if="!finished">
          <p class="pitch-caption">Scegli una maglia. Hai sei tentativi per ogni titolare.</p>
          <button type="button" class="secondary conclude" aria-haspopup="dialog" @click="openFinishDialog">Concludi</button>
        </template>
      </section>

      <section v-if="!finished" id="guess-panel" class="guess-panel" aria-label="Tentativi">
        <form @submit.prevent="submitGuess">
          <input id="guess" ref="guessInput" :value="selected?.draft ?? ''" :disabled="!selected || Boolean(selected.outcome)" type="text" inputmode="text" enterkeyhint="send" autocomplete="off" autocapitalize="characters" :spellcheck="false" aria-label="Il tuo tentativo" @input="editGuess" />
          <button v-if="selected" class="submit" :disabled="!canSubmit">Invia</button>
        </form>
        <template v-if="selected">
          <div class="guess-grid">
            <div v-for="(row, index) in rows" :key="index" class="guess-row" role="group" :aria-label="`Tentativo ${index + 1}`">
              <template v-for="(cell, position) in row" :key="position">
                <span v-if="cell === null" class="word-space" role="img" aria-label="Spazio"></span>
                <span
                  v-else
                  class="letter"
                  :class="cell.feedback"
                  role="img"
                  :aria-label="cell.feedback ? `${cell.letter}: ${feedbackLabels[cell.feedback]}` : (cell.letter ?? 'Casella vuota')"
                >
                  {{ cell.letter }}
                  <small v-if="cell.feedback" aria-hidden="true">{{ feedbackSymbols[cell.feedback] }}</small>
                </span>
              </template>
            </div>
          </div>
          <ul class="legend" aria-label="Significato degli indizi">
            <li><span class="correct" aria-hidden="true">✓</span> Posizione corretta</li>
            <li><span class="present" aria-hidden="true">↔</span> Presente altrove</li>
            <li><span class="absent" aria-hidden="true">×</span> Assente</li>
          </ul>
        </template>
        <p v-else class="intro">Seleziona la maglia sul campo e scrivi il nome. Ogni lettera è un indizio.</p>
      </section>
    </div>
    <dialog v-if="!finished" ref="finishDialog" class="finish-dialog" aria-labelledby="finish-title">
      <h2 id="finish-title">{{ remaining === 1 ? 'Vuoi rivelare 1 titolare rimasto?' : `Vuoi rivelare i ${remaining} titolari rimasti?` }}</h2>
      <form method="dialog">
        <button class="secondary" autofocus>Continua a giocare</button>
        <button type="button" class="submit" @click="finishEarly">Rivela e concludi</button>
      </form>
    </dialog>
    <footer>Missing XI · Una formazione, undici ricordi.</footer>
  </main>
</template>
