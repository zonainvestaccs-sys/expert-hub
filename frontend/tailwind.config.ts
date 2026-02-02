// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',        // caso exista app/ fora do src
    './src/**/*.{js,ts,jsx,tsx,mdx}',        // seu padrão atual
  ],
  theme: {
    extend: {
      colors: {
        zincish: {
          950: '#05060b',
          900: '#070913',
        },
      },
    },
  },
  plugins: [],
};

export default config;
