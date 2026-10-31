import net from "node:net";
import dgram from "node:dgram";
import { syncBuiltinESMExports } from "node:module";

const stateKey = Symbol.for("tenable-axi.test-network");
const globals = globalThis as typeof globalThis & { [key: symbol]: { ports: Set<number>; connect: typeof net.Socket.prototype.connect } };
const state = globals[stateKey] ??= { ports: new Set<number>(), connect: net.Socket.prototype.connect };
const deny = () => { throw new Error("Network access is disabled during offline tests"); };
net.Socket.prototype.connect = function (this: net.Socket, ...args: unknown[]) {
  const values = Array.isArray(args[0]) ? args[0] : args;
  const options = values[0];
  const port = typeof options === "object" ? (options as net.NetConnectOpts & { port?: number }).port : options;
  const host = typeof options === "object" ? (options as net.NetConnectOpts & { host?: string }).host : values[1];
  if (host !== "127.0.0.1" || !state.ports.has(Number(port))) return deny();
  return Reflect.apply(state.connect, this, args) as net.Socket;
};
dgram.Socket.prototype.send = deny;
globalThis.fetch = deny;
syncBuiltinESMExports();

// Only a fixture holding an actively listening server may register its port.
export function allowFakeServer(server: net.Server) {
  const address = server.address();
  if (!address || typeof address === "string" || address.address !== "127.0.0.1") return deny();
  state.ports.add(address.port);
  return () => state.ports.delete(address.port);
}
