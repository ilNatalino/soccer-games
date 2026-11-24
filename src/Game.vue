<script setup lang="ts">
import { computed, nextTick, reactive, ref, shallowRef, useTemplateRef } from 'vue'
import { orderStarters, quizPlayerName, teamColors, type StrikerMatch } from './strikerapi'
import { evaluateGuess } from './wordle'

const { match } = defineProps<{ match: StrikerMatch }>()
const { game } = match
const quizTeam = game[match.quiz_side ?? 'away']
const formation = match.lineups.find(team => team.team_id === quizTeam.team_id)!
const isDemo = game.game_id === 'demo'
const paletteTeamId = formation.team_id === 'inter' ? '110' : formation.team_id
const palette = teamColors.get(paletteTeamId)
const shirtColors = {
  '--shirt-color': palette?.color,
  '--shirt-number-color': palette?.text_color,
  '--shirt-accent': palette?.accent_color,
  '--shirt-band-color-1': palette?.band_colors?.[0],
  '--shirt-band-color-2': palette?.band_colors?.[1],
}
const dateLabel = new Intl.DateTimeFormat('it-IT', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(game.date))
const maxAttempts = 6
const progressKey = isDemo
  ? `missing-xi:${game.date}:${quizTeam.name}:v1`
  : `missing-xi:strikerapi:${game.game_id}:${quizTeam.team_id}:v1`
type ShirtOutcome = 'Indovinato' | 'Rivelato' | ''
const endedEarly = ref(false)
const starters = orderStarters(formation.starting_xi)
let offset = 0
const lineup = reactive([1, ...formation.formation.split('-').map(Number)].map((size, row, rows) => {
  const players = starters.slice(offset, offset + size).map(player => {
    const preferredName = isDemo ? player.name : quizPlayerName(formation.team_id, player)
    const name = letters(preferredName) ? preferredName : player.name
    return {
      player,
      name,
      pattern: namePattern(name),
      get answer() { return this.pattern.replaceAll(' ', '') },
      draft: '',
      attempts: [] as string[],
      get outcome(): ShirtOutcome {
        if (this.attempts.includes(this.answer)) return 'Indovinato'
        return endedEarly.value || this.attempts.length === maxAttempts ? 'Rivelato' : ''
      },
      get visibleOutcome(): ShirtOutcome {
        return revealing.value?.shirt === this ? '' : this.outcome
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
const guessedCount = computed(() => shirts.filter(shirt => shirt.outcome === 'Indovinato').length)
const totalAttempts = computed(() => shirts.reduce((total, shirt) => total + shirt.attempts.length, 0))
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
const revealing = shallowRef<{ shirt: Shirt; row: number; stagger: number } | null>(null)
const celebrating = shallowRef<Shirt | null>(null)

let lastSnapshot: string | null = null
const selected = ref<Shirt | null>(restoreProgress() ?? null)
const started = ref(lastSnapshot !== null)
const phase = computed(() => {
  if (!started.value) return 'ready'
  return remaining.value === 0 && !revealing.value ? 'finished' : 'playing'
})
const finished = computed(() => phase.value === 'finished')
const guessInput = useTemplateRef<HTMLInputElement>('guessInput')
const guessGrid = useTemplateRef<HTMLDivElement>('guessGrid')
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
    return positions.map(cell => cell === null ? null : { index: cell, letter: text[cell], feedback: feedback[cell] })
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

function namePattern(name: string) {
  return name.trim().split(/\s+/).map(letters).join(' ')
}

function attemptLabel(count: number) {
  return `${count} ${count === 1 ? 'tentativo' : 'tentativi'}`
}

function shirtDescription(shirt: Shirt) {
  const details = []
  if (shirt.player.goals > 0) details.push('Marcatore')
  if (shirt.visibleOutcome) details.push(attemptLabel(shirt.attempts.length))
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
    const names = 'names' in saved ? saved.names : undefined
    if (names !== undefined && (!names || typeof names !== 'object' || Array.isArray(names))) return

    const restored = shirts.map(shirt => {
      const { jersey } = shirt.player
      const guesses = (byNumber as Record<string, unknown>)[jersey]
      if (!Array.isArray(guesses) || guesses.length > maxAttempts) return
      const name = names === undefined ? shirt.player.name : (names as Record<string, unknown>)[jersey]
      if (typeof name !== 'string' || !letters(name)) return
      const pattern = namePattern(name)
      const answer = pattern.replaceAll(' ', '')
      if (guesses.every((guess: unknown, index): guess is string => typeof guess === 'string'
        && guess.length === answer.length && letters(guess) === guess
        && (guess !== answer || index === guesses.length - 1))) return { shirt, guesses, name, pattern }
    })
    if (!restored.every(entry => entry !== undefined)) return

    revealing.value = null
    celebrating.value = null
    for (const { shirt, guesses, name, pattern } of restored) {
      if (shirt.name !== name) shirt.draft = ''
      shirt.name = name
      shirt.pattern = pattern
      shirt.attempts = guesses
    }
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
      names: Object.fromEntries(shirts.map(shirt => [shirt.player.jersey, shirt.name])),
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
  if (!shirt || shirt.outcome) return
  const input = event.target as HTMLInputElement
  const cursor = letters(input.value.slice(0, input.selectionStart ?? input.value.length)).length
  shirt.draft = letters(input.value).slice(0, shirt.answer.length)
  input.value = shirt.draft
  input.setSelectionRange(cursor, cursor)
}

async function focusGame() {
  await nextTick()
  if (finished.value) scoreHeading.value?.focus()
  else if (!selected.value) pitch.value?.querySelector<HTMLButtonElement>('button.player')?.focus()
  else if (selected.value.visibleOutcome) pitch.value?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.focus()
  else guessInput.value?.focus()
}

function startGame() {
  selected.value = restoreProgress() ?? null
  started.value = true
  return focusGame()
}

function submitGuess() {
  restoreProgress()
  const shirt = selected.value
  if (remaining.value === 0 || shirt?.outcome) {
    if (!revealing.value) return focusGame()
    return
  }
  if (!shirt || !canSubmit.value) return
  celebrating.value = null
  shirt.attempts.push(shirt.draft)
  shirt.draft = ''
  saveProgress()
  if (reducedMotion.matches) {
    revealing.value = null
    return focusGame()
  }
  return revealFeedback(shirt)
}

async function revealFeedback(shirt: Shirt) {
  const attempt = {
    shirt,
    row: shirt.attempts.length - 1,
    stagger: Math.min(32, 270 / Math.max(1, shirt.answer.length - 1)),
  }
  revealing.value = attempt
  if (!shirt.outcome) await focusGame()
  else await nextTick()
  if (revealing.value !== attempt) return

  const row = guessGrid.value?.children[attempt.row]
  row?.scrollIntoView({ block: 'nearest' })
  const animations = row?.getAnimations({ subtree: true }) ?? []
  await Promise.allSettled(animations.map(animation => animation.finished))
  if (revealing.value !== attempt) return
  finishReveal()
  if (!shirt.outcome) return

  const active = document.activeElement
  if (finished.value || active === document.body || (active && guessInput.value?.form?.contains(active))) {
    return focusGame()
  }
}

function finishReveal() {
  const shirt = revealing.value?.shirt
  revealing.value = null
  if (shirt?.outcome === 'Indovinato' && !reducedMotion.matches) celebrating.value = shirt
}

function selectShirt(shirt: Shirt) {
  if (remaining.value === 0) return
  if (selected.value !== shirt) finishReveal()
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
  revealing.value = null
  celebrating.value = null
  restoreProgress()
  if (!finished.value) {
    endedEarly.value = true
    saveProgress()
  }
  return focusGame()
}
</script>

<template>
  <slot v-if="phase !== 'ready'" name="calendar" />
  <section v-if="phase !== 'ready'" class="match" aria-labelledby="match-title">
    <p class="eyebrow">{{ isDemo ? 'Serie A · Il derby di Milano' : 'Serie A' }}</p>
    <div class="match-heading">
      <h1 id="match-title">{{ game.home.name }} <strong>{{ game.home.score }}–{{ game.away.score }}</strong> {{ game.away.name }}</h1>
      <time :datetime="game.date">{{ dateLabel }}</time>
    </div>
    <p v-if="isDemo">Una notte da ricordare. Ma ricordi chi era in campo?</p>
  </section>

  <section v-if="phase === 'ready'" class="start-screen" aria-label="Avvio della sfida">
    <h1 class="wordmark start-logo">MISSING <b>XI</b></h1>
    <button type="button" class="submit" @click="startGame">Inizia</button>
  </section>
  <div v-else class="game-layout" :class="{ finished }">
    <section class="formation" aria-labelledby="formation-title">
      <div v-if="finished" class="challenge-result">
        <h2 ref="scoreHeading" tabindex="-1" aria-describedby="challenge-score">Sfida conclusa</h2>
        <p id="challenge-score">{{ guessedCount }} su {{ shirts.length }} indovinati · {{ attemptLabel(totalAttempts) }}</p>
      </div>
      <div class="section-heading">
        <h2 id="formation-title">{{ quizTeam.name }}</h2>
        <span>{{ formation.formation }}</span>
      </div>
      <div ref="pitch" class="pitch" :style="shirtColors">
        <div class="pitch-markings" aria-hidden="true"><i></i></div>
        <div v-for="line in lineup" :key="line.row" class="pitch-row" :style="{ '--shirts-in-row': line.players.length }">
          <component
            v-for="shirt in line.players"
            :key="shirt.player.player_id"
            :is="finished ? 'div' : 'button'"
            :type="finished ? undefined : 'button'"
            :disabled="!finished && remaining === 0"
            class="player"
            :class="{ selected: !finished && selected === shirt, resolved: shirt.visibleOutcome, celebrating: celebrating === shirt }"
            :aria-label="finished ? undefined : (shirt.visibleOutcome ? `Maglia ${shirt.player.jersey}, ${shirt.name}, ${shirt.visibleOutcome}` : `Maglia ${shirt.player.jersey}, ${line.role}`)"
            :aria-description="finished ? undefined : shirtDescription(shirt)"
            :aria-pressed="finished ? undefined : selected === shirt"
            :aria-controls="finished ? undefined : 'guess-panel'"
            @click="!finished && selectShirt(shirt)"
            @animationend.self="celebrating === shirt && (celebrating = null)"
          >
            <span class="shirt-icon">
              <span
                class="shirt"
                :class="{ goalkeeper: line.role === 'portiere' }"
                :data-pattern="line.role === 'portiere' ? undefined : palette?.pattern"
                :aria-hidden="!finished"
              >{{ shirt.player.jersey }}</span>
              <span v-if="shirt.player.goals > 0" class="scorer-icon" role="img" aria-label="Marcatore" :aria-hidden="!finished">⚽</span>
            </span>
            <span class="player-caption">
              <span>{{ shirt.visibleOutcome ? shirt.name : '· · ·' }}</span>
              <span v-if="shirt.visibleOutcome" class="player-attempts" :title="attemptLabel(shirt.attempts.length)" aria-hidden="true">{{ shirt.attempts.length }}</span>
              <span v-if="finished" class="visually-hidden">{{ attemptLabel(shirt.attempts.length) }}</span>
            </span>
          </component>
        </div>
      </div>
    </section>

    <section v-if="phase === 'playing'" id="guess-panel" class="guess-panel" aria-label="Tentativi">
      <form @submit.prevent="submitGuess">
        <input id="guess" ref="guessInput" :value="selected?.draft ?? ''" :disabled="!selected || Boolean(selected.visibleOutcome)" :readonly="Boolean(selected?.outcome)" type="text" inputmode="text" enterkeyhint="send" autocomplete="off" autocapitalize="characters" :spellcheck="false" aria-label="Il tuo tentativo" @input="editGuess" />
        <button v-if="selected" class="submit" :disabled="!canSubmit">Invia</button>
      </form>
      <template v-if="selected">
        <div :key="selected.player.player_id" ref="guessGrid" class="guess-grid">
          <div v-for="(row, index) in rows" :key="index" class="guess-row" :class="{ revealing: revealing?.row === index }" role="group" :aria-label="`Tentativo ${index + 1}`">
            <template v-for="(cell, position) in row" :key="position">
              <span v-if="cell === null" class="word-space" role="img" aria-label="Spazio"></span>
              <span
                v-else
                class="letter"
                :class="cell.feedback"
                :style="revealing?.row === index ? { '--letter-delay': `${cell.index * revealing.stagger}ms` } : undefined"
                role="img"
                :aria-label="cell.feedback ? `${cell.letter}: ${feedbackLabels[cell.feedback]}` : (cell.letter ?? 'Casella vuota')"
              >
                {{ cell.letter }}
                <small v-if="cell.feedback" aria-hidden="true">{{ feedbackSymbols[cell.feedback] }}</small>
              </span>
            </template>
          </div>
        </div>
      </template>
      <p v-else class="intro">Seleziona la maglia sul campo e scrivi il nome. Ogni lettera è un indizio.</p>
      <button type="button" class="secondary conclude" :disabled="remaining === 0" aria-haspopup="dialog" @click="openFinishDialog">Termina</button>
    </section>
  </div>
  <dialog v-if="phase === 'playing' && remaining > 0" ref="finishDialog" class="finish-dialog" aria-labelledby="finish-title">
    <h2 id="finish-title">{{ remaining === 1 ? 'Vuoi rivelare 1 titolare rimasto?' : `Vuoi rivelare i ${remaining} titolari rimasti?` }}</h2>
    <form method="dialog">
      <button class="secondary" autofocus>Continua a giocare</button>
      <button type="button" class="submit" @click="finishEarly">Rivela e concludi</button>
    </form>
  </dialog>
</template>
