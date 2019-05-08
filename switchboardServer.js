'use strict';

import * as actionTypes from './actionTypes';

import uuid from 'uuid/v3';

const initiateDialogue = (initiator) => {
    try{
        if(initiator.status !== 'inDialogue'){
            console.log('Initiating dialogue...');
            initiator.peers.forEach((p, _) => {
                console.log(`Notifying peer ${p.id}`);
                p.status = 'inDialogue';
                p.connection.sendUTF(JSON.stringify({
                    type: 'initiateDialogue',
                    initiator: false,
                }));
            });
            initiator.status = 'inDialogue';
            initiator.connection.sendUTF(JSON.stringify({
                type: 'initiateDialogue',
                initiator: true,
            }));
        } else {
            console.log('Already in dialogue');
        }
    } catch (err) {
        console.log('Initiating dialogue failed ' + err);
    }
};

const relaySignal = server => (signal, receiverId, senderId) => {
    try{
        server.clientsById.get(receiverId).connection.sendUTF(JSON.stringify({
            type: actionTypes.SIGNAL,
            signal: signal,
            from: senderId
        }));
    } catch (err) {
        console.log(`Relaying signal to ${receiverId} failed ` + err);
    }
};

const shuffle = (array) => {
    let currentIndex = array.length, temporaryValue, randomIndex;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {
        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
};

const chunk = (array, size = 1) => {
    let length = array === null ? 0 : array.length;
    if (!length || size < 1) {
        return [];
    }
    let index = 0,
        resIndex = 0,
        result = Array(Math.ceil(length / size));

    while (index < length) {
        result[resIndex++] = array.slice(index, (index += size));
    }
    return result;
};

const filterSet = function* (entries, pred) {
    for (let e of entries) {
        if(pred(e[1])) yield e[1];
    }
};

const pairClients = clients => {
    chunk(shuffle(clients), 2).forEach(pair => {
        if(pair.length === 2 && !pair[0].unreachable.has(pair[1].id) && !pair[1].unreachable.has(pair[0].id)){
            console.log(`try to pair client ${pair[0].id} and client ${pair[1].id}`);
            pair[0].status = 'sentCandidatePeer';
            pair[0].signalingData = [];
            pair[0].connection.sendUTF(JSON.stringify({
                type: actionTypes.CANDIDATE_PEER,
                initiator: true,
                peerId: pair[1].id
            }));
            pair[1].status = 'sentCandidatePeer';
            pair[1].signalingData = [];
            pair[1].connection.sendUTF(JSON.stringify({
                type: actionTypes.CANDIDATE_PEER,
                initiator: false,
                peerId: pair[0].id
            }));
        }
    });
};

const peerMatching = server => {
    server.rooms.forEach((clients, room) => {
        if(room !== '_lobby'){
            console.log(`Peering in room ${room}`);
            clients.forEach((c, _) => {
                console.log(`    Client ${c.id}, status ${c.status}`);
            });
            pairClients(Array.from(filterSet(clients.entries(), c => c.status === 'requestingPeer')));
        }
    });
};

const serverAction = server => action => {
    switch (action.type) {
        case actionTypes.SELFID:
            console.log(`Setting client selfId to ${action.selfId}`);
            action.client.selfId = action.selfId;
            break;
        case actionTypes.REQUEST_PEER:
            console.log(`Client ${action.client.id} requesting peer`);
            action.client.status = 'requestingPeer';
            action.client.peeringConstraints = action.peeringConstraints;
            //reconcile requesting clients
            peerMatching(server);
            break;
        case actionTypes.PEERING:
            console.log(`Client ${action.client.id} is signaling`);
            action.client.status = 'signaling';
            break;
        case actionTypes.RELAY_SIGNAL:
            console.log(`Client ${action.client.id} sharing signaling with ${action.receivingPeer}`);
            action.client.status = 'signaling';
            action.client.signalingData = [...action.client.signalingData,
                action.signal];
            //relay signals
            relaySignal(server)(action.signal,
                action.receivingPeer, action.client.id);
            break;
        case actionTypes.PEERED:
            console.log(`Client ${action.client.id} has peer`);
            action.client.status = 'peered';
            // try{
            //     action.client.peers.add(server.clientsById.get(action.peerId));
            // } catch (err) {
            //     console.log('Client peer is missing');
            //     action.client.connection.sendUTF(JSON.stringify({
            //         type: 'badPeerId',
            //     }));
            // }
            break;
        case actionTypes.INITIATE_DIALOGUE:
            console.log(`Client ${action.client.id} asking to initiate dialogue`);
            initiateDialogue(action.client);
            break;
        case actionTypes.PEERING_FAILED:
            action.client.status = 'requestingPeer';
            action.client.signalingData = [];
            action.client.unreachable.add(action.peerId);
            peerMatching(server);
            break;
        default:
            console.log(`unknown action ${action.type}`);
    }
};

const onConnectionMessage = server => client => message => {
    switch(message.type) {
        case 'utf8':
            try{
                let requestedAction = JSON.parse(message.utf8Data);
                requestedAction.client = client;
                serverAction(server)(requestedAction);
                client.connection.sendUTF(JSON.stringify({
                    type: actionTypes.ACTION_ACKNOWLEDGED,
                    message: 'ok'
                }));
            } catch (err) {
                console.log(`unparsable message from ${client.id}, invalid action ${message.utf8Data}` + err);
                if(client.connection){
                    client.connection.sendUTF(JSON.stringify({
                        type: actionTypes.ACTION_FAILED,
                        message: 'invalid action'
                    }));
                }
            }
            break;
        case 'binary':
            console.log(`Client ${client.id} sent binary message of ${message.binaryData.length} bytes`);
            break;
        default:
            console.log(`Client ${client.id} sent unexpected type of message`);
    }
};


const onRequest = server => (request) => {
    if(!server.requestChecker(request)) {
        request.reject(401);
        console.log(`${new Date()} Connection from origin ${request.origin} rejected.`);
    } else {
        let newConnection = request.accept(null, request.origin);
        let newClient = SwitchboardServer.createClient(request, newConnection);
        console.log((new Date()) + ' Connection accepted.');
        server.connections.add(newConnection);
        server.clients.add(newClient);
        server.clientsById.set(newClient.id, newClient);
        newClient.rooms.forEach(room => {
            console.log((new Date()) + ` adding client to room ${room}.`);
            if(server.rooms.has(room)){
                server.rooms.get(room).add(newClient);
            } else {
                server.rooms.set(room, new Set([newClient]));
            }
        });
        newConnection.sendUTF(JSON.stringify({
            type: actionTypes.SERVERID,
            serverId: newClient.id
        }));
        newConnection.on('message', onConnectionMessage(server)(newClient));
        // newConnection.on('error', onConnectionError);
    }
};

const onClose = server => (connection, reasonCode, description) => {
    console.log(`${new Date()} Connection ${connection.remoteAddress} disconnected (${reasonCode}: ${description})`);
    let connectionKey = SwitchboardServer.genConnectionKey(connection);
    let client = server.clientsById.get(connectionKey);
    server.connections.delete(connection);
    server.clientsById.delete(connectionKey);
    server.clients.delete(client);
    client.rooms.forEach((room) => {
        server.rooms.get(room).delete(client);
        if(server.rooms.get(room).size === 0 && room !== '_lobby'){
            server.rooms.delete(room);
        }
    });
};


class SwitchboardServer {
    constructor(websocketServer, requestChecker = _c => {return true;}) {
        this.connections = new Set();
        this.clients = new Set();
        this.clientsById = new Map();
        this.rooms = new Map([['_lobby', new Set()]]);

        this.requestChecker = requestChecker;
        this.wsServer = websocketServer;

        this.wsServer.on('request', onRequest(this));
        this.wsServer.on('close', onClose(this));
    }

    static genConnectionKey(connection) {
        let socket = connection.socket;
        return `${socket.remoteAddress}${socket.remotePort}`;
    }

    static createClient(request, connection) {
        let newClient = {
            connection,
            id: SwitchboardServer.genConnectionKey(connection),
            rooms: new Set(['_lobby', uuid(request.resource, uuid.URL)]),
            selfId: null,
            status: 'holding', //'peerd', 'signaling', 'requestingPeer', 'sentCandidatePeer', 'inDialogue'
            peeringConstraints: null,
            signalingData: null,
            peers: new Set(),
            unreachable: new Set(),
        };
        console.log((new Date()) + ` New client ${newClient.id}, requested ${request.resource}.`);
        return newClient;
    }
}

export default SwitchboardServer;
