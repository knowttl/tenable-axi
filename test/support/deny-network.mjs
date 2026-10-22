import net from "node:net";
import { syncBuiltinESMExports } from "node:module";

const deny = () => { throw new Error("Network access is disabled during offline tests"); };
net.Socket.prototype.connect = deny;
net.connect = deny;
net.createConnection = deny;
globalThis.fetch = deny;
syncBuiltinESMExports();
