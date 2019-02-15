'use strict';

import dotenv from 'dotenv';
dotenv.config();

import websocketServerFactory from './websocketServerFactory';
import SwitchboardServer from './switchboardServer';
import http from 'http';
import url from 'url';

const serverPort = process.env.SWITCHBOARDPORT || 6666;
const serverDomain = process.env.SWITCHBOARDDOMAIN || 'localhost';

let server = http.createServer(function(request, response) {
    console.log((new Date()) + ' Received irrelevant request for ' + request.url);
    response.writeHead(404);
    response.end();
});

server.listen(serverPort, function() {
    console.log((new Date()) + ` Server is listening at ${server.address().address}:${server.address().port}`);
});

let {_, websocketServer} = websocketServerFactory(server, serverPort, false);

const requestIsAllowed = (request) => {
    console.log((new Date()) + ' Connection from origin ' + request.origin + '.');
    return true;
};

let _switchboard = new SwitchboardServer(websocketServer, requestIsAllowed);

let minutes = 1;
let check_interval = minutes * 60 * 1000;

setInterval(() => {
    console.log(`${new Date()} Server check.`);
    console.log(`    Room count: ${_switchboard.rooms.size}`);
    console.log(`    Client count: ${_switchboard.clients.size}`);

}, check_interval);

export default server;
