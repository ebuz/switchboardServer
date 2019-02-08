import test from 'tape';
import fetch from 'node-fetch';
import websocketServerFactory from '../websocketServerFactory';
import switchboardServer from '../switchboardServer';
import { client as websocketClient } from 'websocket';

test('create new server', function(t) {
    t.plan(5);
    const serverPort = 6668;
    const serverUrl = `localhost:${serverPort}`;
    let {server, websocketServer} = websocketServerFactory(null, serverPort);
    let client = new websocketClient();
    client.connect(`ws://${serverUrl}`);
    client.on('connect', connection => {
        t.equal(connection.remoteAddress, '127.0.0.1', 'websocket client can connect to server');
        t.doesNotThrow(() => {
            connection.ping();
        }, 'Ping-ing server');
        connection.close();
    });


    fetch(`http://${serverUrl}`)
        .then(response => {
            t.equal(response.status, 404, 'server responds with 404 for GET');
            return response;
        })
        .then(() => {
            t.doesNotThrow(() => {websocketServer.shutDown();},
                'successfully shutdown websocket server');
            t.doesNotThrow(() => {server.close();},
                'successfully shutdown http server');
            t.end();
        })
        .catch(err => {
            t.comment(err);
            t.fail('server failed to respond');
        });
});

test('create switchboard server', function(t) {
    t.plan(4);
    const serverPort = 6668;
    const serverUrl = `localhost:${serverPort}`;
    let {server, websocketServer} = websocketServerFactory(null, serverPort, false);
    let switchboard = new switchboardServer(websocketServer);

    let client = new websocketClient();
    let clientConnection = null;
    client.connect(`ws://${serverUrl}`);

    client.on('connect', connection => {
        clientConnection = connection;
        t.equal(connection.remoteAddress, '127.0.0.1',
            'websocket client can connect to server');
        t.doesNotThrow(() => {
            connection.ping();
        }, 'Ping-ing server');
    });

    setTimeout(function() {
        if(!clientConnection){
            t.fail('client never connected');
        }
        t.equal(switchboard.clients.size, 1,
            'Check if server sees new client');
        clientConnection.close();
    }, 2000);

    setTimeout(function() {
        t.equal(switchboard.clients.size, 0,
            'Check if server acknowledges disconnected client');
        websocketServer.shutDown();
        server.close();
        t.end();
    }, 3000);
});

test('Clients can request peers', function(t) {
    t.plan(2);
    const serverPort = 6668;
    const serverUrl = `localhost:${serverPort}`;
    let {server, websocketServer} = websocketServerFactory(null, serverPort, false);
    let switchboard = new switchboardServer(websocketServer);

    let clients = new Map(['one', 'two', 'three'].map(c => [c, new websocketClient()]));
    let clientConnections = new Map();
    clients.forEach((c, n) => {
        c.on('connect', connection => {
            clientConnections.set(n, connection);
        });
    });

    clients.forEach(c => c.connect(`ws://${serverUrl}`));

    setTimeout(function() {
        t.doesNotThrow(() => {
            clientConnections.get('one').sendUTF(JSON.stringify({
                type: 'requestPeer',
                peeringConstraints: null
            }));
        }, 'send server message');
        clientConnections.get('two').sendUTF(JSON.stringify({
            type: 'requestPeer',
            peeringConstraints: null
        }));
        clientConnections.get('three').sendUTF(JSON.stringify({
            type: 'requestPeer',
            peeringConstraints: null
        }));
    }, 2000);

    setTimeout(function() {
        t.equal(switchboard.clients.size, clients.size,
            'Check if server sees all clients');
    }, 3000);

    setTimeout(function() {
        websocketServer.shutDown();
        server.close();
        t.end();
    }, 4000);
});

