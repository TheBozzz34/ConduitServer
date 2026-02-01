import { WebSocketServer, WebSocket } from 'ws';
import net from 'net';
import { v4 as uuidv4 } from 'uuid';

interface Client {
  id: string;
  ws: WebSocket;
  tcpServer: net.Server;
  streams: Map<string, net.Socket>;
}

export class TunnelServer {
  private wss = new WebSocketServer({ port: 8080 });
  private clients = new Map<string, Client>();
  private nextPort = 40000;

  constructor() {
    console.log('Tunnel server started');
    
    this.wss.on('connection', ws => {
      const clientId = uuidv4();
      console.log(`WS connected ${clientId}`);
      
      ws.on('message', msg => this.handleWS(clientId, ws, msg.toString()));
      ws.on('close', () => this.cleanup(clientId));
    });
  }

  private handleWS(clientId: string, ws: WebSocket, raw: string) {
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    const client = this.clients.get(clientId);

    switch (msg.type) {
      case 'register': {
        const port = this.nextPort++;
        const streams = new Map<string, net.Socket>();
        
        const tcpServer = net.createServer(socket => {
          const streamId = uuidv4();
          streams.set(streamId, socket);
          
          ws.send(JSON.stringify({ type: 'open', streamId }));
          
          socket.on('data', data => {
            ws.send(JSON.stringify({
              type: 'data',
              streamId,
              data: data.toString('base64')
            }));
          });
          
          socket.on('close', () => {
            streams.delete(streamId);
            ws.send(JSON.stringify({ type: 'close', streamId }));
          });
        });
        
        tcpServer.listen(port, '0.0.0.0');
        
        this.clients.set(clientId, {
          id: clientId,
          ws,
          tcpServer,
          streams
        });
        
        ws.send(JSON.stringify({
          type: 'registered',
          clientId,
          port
        }));
        break;
      }

      case 'data': {
        if (!client) return;
        const socket = client.streams.get(msg.streamId);
        if (socket) {
          socket.write(Buffer.from(msg.data, 'base64'));
        }
        break;
      }

      case 'close': {
        if (!client) return;
        const socket = client.streams.get(msg.streamId);
        socket?.destroy();
        client.streams.delete(msg.streamId);
        break;
      }

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;
    }
  }

  private cleanup(clientId: string) {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    console.log(`Cleaning up ${clientId}`);
    client.tcpServer.close();
    client.streams.forEach(s => s.destroy());
    this.clients.delete(clientId);
  }
  public getStats() {
    return {
      connectedClients: this.clients.size,
      clients: Array.from(this.clients.values()).map(c => ({
        id: c.id,
        activeStreams: c.streams.size
      }))
    };
  }
}

new TunnelServer();