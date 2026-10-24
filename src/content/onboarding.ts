export const INTRO = {
  title: 'Inside the Machine',
  subtitle: 'An interactive journey through a language model',
  body: [
    'You are about to step inside a Transformer — the architecture behind GPT-style models — and watch a prompt become a response, one token at a time.',
    'Every glowing lane is a token. Arches are attention, where tokens exchange information. Towers are MLPs, where each token is processed on its own. The pink loop is generation feeding itself.',
  ],
  honesty:
    'This is a faithful picture of the computations, not a window into an AI’s thoughts. Badges mark what is truly computed versus illustrative.',
  controls: [
    ['Space', 'Play / pause'],
    ['← →', 'Step between operations'],
    ['Drag / scroll', 'Orbit & zoom (switches to Explore)'],
    ['Click a structure', 'Inspect it'],
  ] as const,
};
