import '../../scripts/node-server-context.mjs';
import net from 'node:net';
// Tests/CLI only. Mark attempts before throwing, even if application code catches the error.
globalThis.fetch = async () => {
  process.stderr.write('[test-network-blocked]\n');
  throw new Error('La prueba prohíbe toda solicitud externa.');
};
// Build fixtures reserve TCP port 1 as an impossible DB. Never open that connection.
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  const port = typeof first === 'object' && first !== null ? first.port : first;
  if (Number(port) === 1) {
    process.stderr.write('[test-database-blocked]\n');
    throw new Error('La compilación no debe consultar PostgreSQL.');
  }
  return Reflect.apply(connect, this, args);
};
