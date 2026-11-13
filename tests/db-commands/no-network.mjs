import '../../scripts/node-server-context.mjs';
// Loaded only by disposable command integration tests. Production code is unchanged.
globalThis.fetch = async () => { throw new Error('La prueba prohíbe toda solicitud externa.'); };
