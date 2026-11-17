# Activar en la terminal actual: source scripts/local-env.zsh
# Solo modifica PATH en esta sesión; no carga secretos ni modifica perfiles del usuario.
() {
  local project="${${(%):-%x}:A:h:h}"
  local node_runtime="$project/.local-runtime/node"
  local pg_runtime="$project/.local-postgres/runtime-18.7"
  if [[ ! -x "$node_runtime/bin/node" || ! -x "$pg_runtime/bin/postgres" ]]; then
    print -u2 'Faltan runtimes locales. Revisá docs/entorno-local-versiones.md.'
    return 1
  fi
  if [[ "$("$node_runtime/bin/node" --version)" != 'v26.13.1' ||
        "$("$node_runtime/bin/node" "$node_runtime/lib/node_modules/npm/bin/npm-cli.js" --version)" != '11.7.0' ||
        "$("$pg_runtime/bin/postgres" --version)" != 'postgres (PostgreSQL) 18.7' ]]; then
    print -u2 'Los runtimes locales no coinciden con los pines del proyecto.'
    return 1
  fi
  export PATH="$node_runtime/bin:$pg_runtime/bin:$PATH"
  rehash
  print 'ASVO local: Node 26.13.1 · npm 11.7.0 · PostgreSQL 18.7'
}
