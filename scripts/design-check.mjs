#!/usr/bin/env node

/**
 * Vérifie que le code respecte le design system:
 * - Pas de couleurs hex dans app/** et components/**
 * - Pas de fontSize/fontWeight bruts dans app/**
 *
 * lib/theme.ts est la source de vérité pour les tokens.
 */

import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');

function runGrep(description, args) {
  try {
    execSync(args.join(' '), { stdio: 'pipe', cwd: root });
    // Pas de match => OK
    return [];
  } catch (error) {
    const output = String(error.stdout || error.stderr || '');
    if (!output.trim()) {
      return [];
    }
    const lines = output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    return lines.map((line) => `${description}: ${line}`);
  }
}

const violations = [];

// 1) Couleurs hex dans app/** et components/** (hors lib/theme.ts)
violations.push(
  ...runGrep(
    'Hex color trouvé',
    [
      'npx',
      'rg',
      '"#[0-9a-fA-F]{3,8}"',
      'app',
      'components',
      '--glob',
      '!*lib/theme.ts',
      '--color',
      'never'
    ]
  )
);

// 2) fontSize brut dans app/**
violations.push(
  ...runGrep(
    'fontSize brut trouvé',
    ['npx', 'rg', '"fontSize\\s*:\\s*\\d+"', 'app', '--color', 'never']
  )
);

// 3) fontWeight brut dans app/**
violations.push(
  ...runGrep(
    'fontWeight brut trouvé',
    ['npx', 'rg', '"fontWeight\\s*:\\s*\\d+"', 'app', '--color', 'never']
  )
);

if (violations.length > 0) {
  // Afficher un message clair et échouer avec code 1
  // eslint-disable-next-line no-console
  console.error(
    [
      '❌ Design system violations détectées.',
      'Corrige ces occurrences pour utiliser les tokens de lib/theme.ts:',
      '',
      ...violations
    ].join('\n')
  );
  process.exit(1);
}

// eslint-disable-next-line no-console
console.log('✅ Design system OK (aucune couleur hex ni font brute dans app/**, components/**).');

