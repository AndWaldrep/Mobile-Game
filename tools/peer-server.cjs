// Local PeerJS server for testing multiplayer without the public PeerJS cloud.
// Run: npm run peer   then open http://localhost:3000/?peerserver=127.0.0.1:9000
// (Listens on IPv4 explicitly; `npx peerjs` fails in some sandboxes without IPv6.)
const http = require('http');
const express = require('express');
const { ExpressPeerServer } = require('peer');

const app = express();
const server = http.createServer(app);
app.use('/', ExpressPeerServer(server, { path: '/', allow_discovery: false }));
const port = Number(process.env.PEER_PORT) || 9000;
server.listen(port, '127.0.0.1', () => console.log(`PeerJS server on 127.0.0.1:${port}`));
