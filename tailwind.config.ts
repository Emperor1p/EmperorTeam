import type { Config } from 'tailwindcss';

const v = (n: string) => `var(--${n})`;

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'), panel: v('panel'), sunk: v('sunk'), line: v('line'), line2: v('line2'),
        ink: v('ink'), mut: v('mut'), acc: v('acc'), 'acc-soft': v('acc-soft'), 'acc-text': v('acc-text'),
        ok: v('ok'), 'ok-bg': v('ok-bg'), warn: v('warn'), 'warn-bg': v('warn-bg'),
        bad: v('bad'), 'bad-bg': v('bad-bg'), info: v('info'), 'info-bg': v('info-bg'), neu: v('neu'), 'neu-bg': v('neu-bg')
      },
      fontFamily: { sans: ['var(--font-instrument)', 'system-ui', 'sans-serif'] }
    }
  },
  plugins: []
} satisfies Config;
