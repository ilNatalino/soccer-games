export type Feedback = 'correct' | 'present' | 'absent'

export function evaluateGuess(answer: string, guess: string): Feedback[] {
  const remaining = new Map<string, number>()
  const feedback: Feedback[] = [...guess].map((letter, index) => {
    if (letter === answer[index]) return 'correct'
    const unmatched = answer[index]!
    remaining.set(unmatched, (remaining.get(unmatched) ?? 0) + 1)
    return 'absent'
  })

  return feedback.map((state, index) => {
    if (state === 'correct') return state
    const letter = guess[index]!
    const count = remaining.get(letter) ?? 0
    if (count === 0) return 'absent'
    remaining.set(letter, count - 1)
    return 'present'
  })
}
