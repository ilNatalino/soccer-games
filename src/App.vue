<script setup lang="ts">
import { computed, nextTick, reactive, ref, useTemplateRef } from 'vue'
import { derby } from './derby'
import { evaluateGuess } from './wordle'
import './style.css'

const maxAttempts = 6
const lineup = reactive(derby.lineup.map(({ role, players }) => ({
  role,
  players: players.map(player => {
    const pattern = player.name.split(' ').map(letters).join(' ')
    return {
      ...player,
      role,
      pattern,
      answer: pattern.replaceAll(' ', ''),
      draft: '',
      attempts: [] as string[],
      get outcome(): 'Indovinato' | 'Rivelato' | '' {
        if (this.attempts.includes(this.answer)) return 'Indovinato'
        return this.attempts.length === maxAttempts ? 'Rivelato' : ''
      },
    }
  }),
})))
type Shirt = (typeof lineup)[number]['players'][number]

const selected = ref<Shirt | null>(null)
const guessInput = useTemplateRef<HTMLInputElement>('guessInput')
const resultMessage = useTemplateRef<HTMLParagraphElement>('resultMessage')
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

function editGuess(event: Event) {
  const shirt = selected.value
  if (!shirt) return
  const input = event.target as HTMLInputElement
  const cursor = letters(input.value.slice(0, input.selectionStart ?? input.value.length)).length
  shirt.draft = letters(input.value).slice(0, shirt.answer.length)
  input.value = shirt.draft
  input.setSelectionRange(cursor, cursor)
}

async function focusGuess() {
  await nextTick()
  if (selected.value?.outcome) resultMessage.value?.focus()
  else guessInput.value?.focus()
}

function submitGuess() {
  const shirt = selected.value
  if (!shirt || !canSubmit.value) return
  shirt.attempts.push(shirt.draft)
  shirt.draft = ''
  return focusGuess()
}

function selectShirt(shirt: Shirt) {
  selected.value = shirt
  return focusGuess()
}
</script>

<template>
  <header class="masthead">
    <a href="/" class="wordmark" aria-label="Missing XI, inizio">MISSING <b>XI</b></a>
    <span>Il calcio, a memoria.</span>
  </header>

  <main>
    <section class="match" aria-labelledby="match-title">
      <p class="eyebrow">Serie A · Il derby di Milano</p>
      <h1 id="match-title">{{ derby.home }} <strong>{{ derby.score }}</strong> {{ derby.away }}</h1>
      <time :datetime="derby.playedOn">{{ derby.date }}</time>
      <p>Una notte da ricordare. Ma ricordi chi era in campo?</p>
    </section>

    <div class="game-layout">
      <section class="formation" aria-labelledby="formation-title">
        <div class="section-heading">
          <h2 id="formation-title">La formazione dell’Inter</h2>
          <span>{{ derby.formation }}</span>
        </div>
        <div class="pitch">
          <div class="pitch-markings" aria-hidden="true"><i></i></div>
          <div v-for="line in lineup" :key="line.role" class="pitch-row">
            <button
              v-for="player in line.players"
              :key="player.number"
              type="button"
              class="player"
              :class="{ selected: selected === player, resolved: player.outcome }"
              :aria-label="player.outcome ? `Maglia ${player.number}, ${player.name}, ${player.outcome}` : `Maglia ${player.number}, ${line.role}`"
              :aria-pressed="selected === player"
              aria-controls="guess-panel"
              @click="selectShirt(player)"
            >
              <span class="shirt" :class="{ goalkeeper: line.role === 'portiere' }" aria-hidden="true">{{ player.number }}</span>
              <span class="player-caption">{{ player.outcome ? player.name : '· · ·' }}</span>
              <span v-if="player.outcome" class="player-outcome">{{ player.outcome }}</span>
            </button>
          </div>
        </div>
        <p class="pitch-caption">Scegli una maglia. Hai sei tentativi per ogni titolare.</p>
      </section>

      <section id="guess-panel" class="guess-panel" aria-labelledby="guess-title">
        <p class="eyebrow">Tocca a te</p>
        <h2 id="guess-title">{{ selected ? `Maglia ${selected.number}` : 'Chi era in campo?' }}</h2>
        <template v-if="selected">
          <p class="muted">{{ selected.role }} · {{ selected.answer.length }} lettere</p>
          <form @submit.prevent="submitGuess">
            <label for="guess">Il tuo tentativo</label>
            <input id="guess" ref="guessInput" :value="selected.draft" :disabled="Boolean(selected.outcome)" type="text" inputmode="text" enterkeyhint="send" autocomplete="off" autocapitalize="characters" :spellcheck="false" aria-describedby="guess-hint" @input="editGuess" />
            <p id="guess-hint" class="input-hint">Inserisci solo le lettere. Anche un nome inventato va bene.</p>
            <button class="submit" :disabled="!canSubmit">Invia tentativo</button>
          </form>
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
          <div role="status" aria-atomic="true">
            <p v-if="selected.outcome" ref="resultMessage" class="result" tabindex="-1">{{ selected.name }} · {{ selected.outcome }}</p>
            <p class="attempt-count">{{ selected.attempts.length }} di {{ maxAttempts }} tentativi inviati</p>
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
    <footer>Missing XI · Una formazione, undici ricordi.</footer>
  </main>
</template>
