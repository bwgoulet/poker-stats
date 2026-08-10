export type BracketFormat = 'double-elimination' | 'round-robin';

export interface SeededTeam {
  id: string;
  name: string;
  seed: number;
}

export interface BracketMatch {
  id: string;
  round: number;
  label: string;
  teamA?: SeededTeam;
  teamB?: SeededTeam;
}

/** Creates the first round using traditional high-vs-low tournament seeding. */
export function seedFirstRound(teams: SeededTeam[]): BracketMatch[] {
  const ordered = [...teams].sort((a, b) => a.seed - b.seed);
  const size = ordered.length <= 1 ? ordered.length : 2 ** Math.ceil(Math.log2(ordered.length));
  const slots: Array<SeededTeam | undefined> = [...ordered, ...Array(size - ordered.length).fill(undefined)];

  return Array.from({ length: Math.ceil(size / 2) }, (_, index) => ({
    id: `w1-${index + 1}`,
    round: 1,
    label: `Match ${index + 1}`,
    teamA: slots[index],
    teamB: slots[size - 1 - index],
  }));
}

/** Uses the circle method so every team meets once and each team plays at most once per round. */
export function roundRobinRounds(teams: SeededTeam[]): BracketMatch[][] {
  const participants: Array<SeededTeam | undefined> = [...teams];
  if (participants.length % 2) participants.push(undefined);
  if (participants.length < 2) return [];

  const rounds: BracketMatch[][] = [];
  for (let round = 0; round < participants.length - 1; round++) {
    const matches: BracketMatch[] = [];
    for (let index = 0; index < participants.length / 2; index++) {
      const teamA = participants[index];
      const teamB = participants[participants.length - 1 - index];
      if (teamA && teamB) matches.push({ id: `rr-${round + 1}-${index + 1}`, round: round + 1, label: `Table ${index + 1}`, teamA, teamB });
    }
    rounds.push(matches);
    participants.splice(1, 0, participants.pop());
  }
  return rounds;
}
