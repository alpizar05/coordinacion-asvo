import '../db-commands/no-network.mjs';
import { registerHooks } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import swc from 'next/dist/build/swc/index.js';
await swc.loadBindings();

// Consumer contracts: run the actual callbacks/effects, replacing only UI/IO boundaries.
// These are deliberately separate from the pure unit suite and from browser evidence.
const stub = new URL('./stubs.mjs', import.meta.url).href;
const doubles = new Set(['react', 'react/jsx-runtime', 'next/link', 'next/navigation']);
registerHooks({
  resolve(specifier, context, next) {
    if (doubles.has(specifier)) return { url: stub, shortCircuit: true };
    if (context.parentURL?.endsWith('/split-group-form.tsx') &&
        ['./action-modal', '../form-feedback/form-feedback', '../actions/outings'].includes(specifier)) {
      return { url: stub, shortCircuit: true };
    }
    if (context.parentURL?.endsWith('/navigation-context.tsx') && specifier === './navigation-position') {
      return { url: stub, shortCircuit: true };
    }
    if (specifier.startsWith('.') && context.parentURL && !/\.[a-z]+$/.test(specifier)) {
      for (const suffix of ['.ts', '.tsx']) {
        const candidate = new URL(specifier + suffix, context.parentURL);
        if (existsSync(candidate)) return next(candidate.href, context);
      }
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('.tsx')) return {
      format: 'module', shortCircuit: true,
      source: swc.transformSync(readFileSync(new URL(url), 'utf8'), {
        filename: new URL(url).pathname,
        jsc: { parser: { syntax: 'typescript', tsx: true }, target: 'es2022', transform: { react: { runtime: 'automatic' } } },
        module: { type: 'es6' },
      }).code,
    };
    return next(url, context);
  },
});
