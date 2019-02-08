import { server as WebSocketServer } from 'websocket';
import http from 'http';

function websocketServerFactory(server = null, serverPort = 6666, autoAcceptConnections = true) {
    if(server === null && serverPort === null){
        throw 'You must either pass a server or give a serverPort to create one';
    }
    if(!server){
        server = http.createServer(function(request, response) {
            console.log((new Date()) + ' Received request for ' + request.url);
            response.writeHead(404);
            response.end();
        });
        server.listen(serverPort, function() {
            console.log((new Date()) + ` Created server listening at ${server.address().address}:${server.address().port}`);
        });
    }
    let websocketServer = new WebSocketServer({
        httpServer: server,
        autoAcceptConnections: autoAcceptConnections
    });

    return {server, websocketServer};
}

export default websocketServerFactory;
