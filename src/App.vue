<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import { derby, etoo } from './derby'
import { evaluateGuess } from './wordle'
import './style.css'

// shortcut: si gioca solo la maglia 9; collegare le altre con il ticket 02.
const selected = ref<number | null>(null)
const guessInput = useTemplateRef<HTMLInputElement>('guessInput')
const resultMessage = useTemplateRef<HTMLParagraphElement>('resultMessage')
const guess = ref('')
const attempts = ref<string[]>([])
const outcome = computed(() => {
  if (attempts.value.includes(etoo.answer)) return 'Indovinato'
  return attempts.value.length >= 6 ? 'Rivelato' : ''
})
const feedback = computed(() => attempts.value.map(attempt => evaluateGuess(etoo.answer, attempt)))
const canSubmit = computed(() => selected.value === etoo.number && !outcome.value && /^[A-Z]{4}$/.test(guess.value))
const feedbackLabels = { correct: 'posizione corretta', present: 'presente altrove', absent: 'assente' }
const feedbackSymbols = { correct: '✓', present: '↔', absent: '×' }

function editGuess(event: Event) {
  const input = event.target as HTMLInputElement
  const letters = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().replace(/[^A-Z]/g, '')
  const cursor = letters(input.value.slice(0, input.selectionStart ?? input.value.length)).length
  guess.value = letters(input.value).slice(0, etoo.answer.length)
  input.value = guess.value
  input.setSelectionRange(cursor, cursor)
}

async function submitGuess() {
  if (!canSubmit.value) return
  attempts.value.push(guess.value)
  guess.value = ''
  await nextTick()
  if (outcome.value) resultMessage.value?.focus()
  else guessInput.value?.focus()
}

async function selectShirt(number: number) {
  selected.value = number
  if (number === 9) {
    await nextTick()
    if (outcome.value) resultMessage.value?.focus()
    else guessInput.value?.focus()
  }
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
          <div v-for="line in derby.lineup" :key="line.role" class="pitch-row">
            <button
              v-for="player in line.players"
              :key="player.number"
              type="button"
              class="player"
              :class="{ selected: selected === player.number, playable: player.number === 9 }"
              :aria-label="player.number === etoo.number && outcome ? `Maglia ${player.number}, ${etoo.name}, ${outcome}` : `Maglia ${player.number}, ${line.role}`"
              :aria-pressed="selected === player.number"
              aria-controls="guess-panel"
              @click="selectShirt(player.number)"
            >
              <span class="shirt" :class="{ goalkeeper: line.role === 'portiere' }" aria-hidden="true">{{ player.number }}</span>
              <span class="player-caption">{{ player.number === etoo.number ? (outcome ? etoo.name : 'Gioca qui') : '· · ·' }}</span>
              <span v-if="player.number === etoo.number && outcome" class="player-outcome">{{ outcome }}</span>
            </button>
          </div>
        </div>
        <p class="pitch-caption">Inizia dalla maglia 9. Hai sei tentativi per ricordare il titolare.</p>
      </section>

      <section id="guess-panel" class="guess-panel" aria-labelledby="guess-title">
        <p class="eyebrow">Tocca a te</p>
        <h2 id="guess-title">{{ selected === null ? 'Chi indossava la 9?' : `Maglia ${selected}` }}</h2>
        <template v-if="selected === 9">
          <p class="muted">Attaccante · 4 lettere</p>
          <div class="guess-grid">
            <div v-for="row in 6" :key="row" class="guess-row" role="group" :aria-label="`Tentativo ${row}`">
              <span
                v-for="cell in 4"
                :key="cell"
                class="letter"
                :class="feedback[row - 1]?.[cell - 1]"
                role="img"
                :aria-label="attempts[row - 1]
                  ? `${attempts[row - 1]![cell - 1]}: ${feedbackLabels[feedback[row - 1]![cell - 1]!]}`
                  : 'Casella vuota'"
              >
                {{ attempts[row - 1]?.[cell - 1] }}
                <small v-if="feedback[row - 1]" aria-hidden="true">{{ feedbackSymbols[feedback[row - 1]![cell - 1]!] }}</small>
              </span>
            </div>
          </div>
          <div role="status" aria-atomic="true">
            <p v-if="outcome" ref="resultMessage" class="result" tabindex="-1">{{ etoo.name }} · {{ outcome }}</p>
            <p class="attempt-count">{{ attempts.length }} di 6 tentativi inviati</p>
          </div>
          <form @submit.prevent="submitGuess">
            <label for="guess">Il tuo tentativo</label>
            <input id="guess" ref="guessInput" :value="guess" :disabled="Boolean(outcome)" type="text" inputmode="text" enterkeyhint="send" autocomplete="off" autocapitalize="characters" :spellcheck="false" aria-describedby="guess-hint" @input="editGuess" />
            <p id="guess-hint" class="input-hint">Quattro lettere, senza apostrofo. Anche un nome inventato va bene.</p>
            <button class="submit" :disabled="!canSubmit">Invia tentativo</button>
          </form>
          <ul class="legend" aria-label="Significato degli indizi">
            <li><span class="correct" aria-hidden="true">✓</span> Posizione corretta</li>
            <li><span class="present" aria-hidden="true">↔</span> Presente altrove</li>
            <li><span class="absent" aria-hidden="true">×</span> Assente</li>
          </ul>
        </template>
        <p v-else class="intro">{{ selected === null ? 'Seleziona la maglia sul campo e scrivi il nome. Ogni lettera è un indizio.' : 'Per questa prima prova è giocabile la maglia 9. Selezionala sul campo.' }}</p>
      </section>
    </div>
    <footer>Missing XI · Una formazione, undici ricordi.</footer>
  </main>
</template>
