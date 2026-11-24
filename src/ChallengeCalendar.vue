<script setup lang="ts">
const { days, today, selectedDate } = defineProps<{
  days: string[]
  today: string
  selectedDate: string
}>()

const dayLabel = new Intl.DateTimeFormat('it-IT', {
  timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short',
})
</script>

<template>
  <nav class="challenge-picker" aria-label="Calendario delle sfide">
    <a
      v-for="date in days"
      :key="date"
      :href="date === today ? '/' : `?giorno=${date}`"
      :aria-current="date === selectedDate ? 'page' : undefined"
    >
      <time :datetime="date">{{ date === today ? 'Oggi' : dayLabel.format(new Date(date)) }}</time>
    </a>
  </nav>
</template>
