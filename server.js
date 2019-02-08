'use strict';

import dotenv from 'dotenv';
dotenv.config();

import websocketServerFactory from './websocketServerFactory';
import SwitchboardServer from './switchboardServerV2';
import http from 'http';
import url from 'url'; // eslint-disable-line

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
    return true;
};

let _switchboard = new SwitchboardServer(websocketServer, requestIsAllowed);

export default server;
