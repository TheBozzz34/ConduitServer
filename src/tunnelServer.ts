import { WebSocketServer, WebSocket } from 'ws';
import * as net from 'net';
import { v4 as uuidv4 } from 'uuid';
import { TunnelClient, TunnelMessage, ServerConfig } from './types';
import { PortManager } from './portManager';

export class TunnelServer {
  private wss: WebSocketServer;
  private clients: Map<string, TunnelClient> = new Map();
  private portManager: PortManager;
  private tcpServers: Map<number, net.Server> = new Map();
  private config: ServerConfig;
  private cleanupInterval: NodeJS.Timeout;

  constructor(config: ServerConfig) {
    this.config = config;
    this.portManager = new PortManager(config.minTunnelPort, config.maxTunnelPort);
    
    this.wss = new WebSocketServer({ port: config.port });
    console.log(`WebSocket server started on port ${config.port}`);

    this.wss.on('connection', this.handleConnection.bind(this));

    // Cleanup idle connections
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleClients();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Handle new WebSocket connection from plugin client
   */
  private handleConnection(ws: WebSocket): void {
    const clientId = uuidv4();
    console.log(`New client connection: ${clientId}`);

    ws.on('message', (data: Buffer) => {
      try {
        const message: TunnelMessage = JSON.parse(data.toString());
        this.handleMessage(clientId, ws, message);
      } catch (error) {
        console.error('Error parsing message:', error);
        this.sendError(ws, 'Invalid message format');
      }
    });

    ws.on('close', () => {
      this.handleDisconnect(clientId);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
      this.handleDisconnect(clientId);
    });
  }

  /**
   * Handle messages from plugin clients
   */
  private handleMessage(clientId: string, ws: WebSocket, message: TunnelMessage): void {
    switch (message.type) {
      case 'register':
        this.registerClient(clientId, ws, message.port || 25565);
        break;
      
      case 'ping':
        this.handlePing(clientId);
        break;

      default:
        console.warn(`Unknown message type: ${message.type}`);
    }
  }

  /**
   * Register a new tunnel client
   */
  private registerClient(clientId: string, ws: WebSocket, minecraftPort: number): void {
    if (this.clients.size >= this.config.maxClients) {
      this.sendError(ws, 'Server at maximum capacity');
      ws.close();
      return;
    }

    const assignedPort = this.portManager.allocatePort(clientId);
    if (!assignedPort) {
      this.sendError(ws, 'No available ports');
      ws.close();
      return;
    }

    const client: TunnelClient = {
      id: clientId,
      ws,
      assignedPort,
      minecraftServerPort: minecraftPort,
      createdAt: new Date(),
      lastActivity: new Date()
    };

    this.clients.set(clientId, client);
    this.startTCPServer(client);

    // Send success response
    const response: TunnelMessage = {
      type: 'register',
      clientId,
      port: assignedPort
    };
    ws.send(JSON.stringify(response));
    console.log(`Client ${clientId} registered with port ${assignedPort}`);
  }

  /**
   * Start TCP server for tunneling Minecraft traffic
   */
  private startTCPServer(client: TunnelClient): void {
    const server = net.createServer((socket) => {
      console.log(`TCP connection on port ${client.assignedPort} for client ${client.id}`);
      
      let isSocketClosed = false;
      
      // Forward data from Minecraft player to plugin via WebSocket
      socket.on('data', (data) => {
        if (client.ws.readyState === WebSocket.OPEN) {
          const message: TunnelMessage = {
            type: 'data',
            data: data.toString('base64')
          };
          client.ws.send(JSON.stringify(message));
          console.log(`Forwarded ${data.length} bytes from player to plugin`);
        }
      });

      // Handle plugin responses - forward back to Minecraft player
      const messageHandler = (wsData: Buffer) => {
        try {
          const message: TunnelMessage = JSON.parse(wsData.toString());
          if (message.type === 'data' && typeof message.data === 'string' && !isSocketClosed) {
            const buffer = Buffer.from(message.data, 'base64');
            socket.write(buffer);
            console.log(`Forwarded ${buffer.length} bytes from plugin to player`);
          }
        } catch (error) {
          console.error('Error handling WebSocket data:', error);
        }
      };

      client.ws.on('message', messageHandler);

      socket.on('close', () => {
        console.log(`TCP connection closed on port ${client.assignedPort}`);
        isSocketClosed = true;
        client.ws.off('message', messageHandler);
      });

      socket.on('error', (error) => {
        console.error(`TCP socket error on port ${client.assignedPort}:`, error);
        isSocketClosed = true;
        socket.destroy();
      });
    });

    server.listen(client.assignedPort, '0.0.0.0', () => {
      console.log(`TCP tunnel server listening on port ${client.assignedPort}`);
    });

    this.tcpServers.set(client.assignedPort, server);
  }

  /**
   * Handle ping to keep connection alive
   */
  private handlePing(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastActivity = new Date();
      const response: TunnelMessage = { type: 'pong' };
      client.ws.send(JSON.stringify(response));
    }
  }

  /**
   * Handle client disconnect
   */
  private handleDisconnect(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    console.log(`Client ${clientId} disconnected`);

    // Close TCP server
    const tcpServer = this.tcpServers.get(client.assignedPort);
    if (tcpServer) {
      tcpServer.close();
      this.tcpServers.delete(client.assignedPort);
    }

    // Release port
    this.portManager.releasePort(client.assignedPort);

    // Remove client
    this.clients.delete(clientId);
  }

  /**
   * Cleanup idle clients
   */
  private cleanupIdleClients(): void {
    const now = new Date();
    this.clients.forEach((client, clientId) => {
      const idleTime = now.getTime() - client.lastActivity.getTime();
      if (idleTime > this.config.idleTimeout) {
        console.log(`Cleaning up idle client ${clientId}`);
        client.ws.close();
        this.handleDisconnect(clientId);
      }
    });
  }

  /**
   * Send error message to client
   */
  private sendError(ws: WebSocket, error: string): void {
    const message: TunnelMessage = {
      type: 'error',
      error
    };
    ws.send(JSON.stringify(message));
  }

  /**
   * Get server statistics
   */
  getStats() {
    return {
      activeClients: this.clients.size,
      availablePorts: this.portManager.getAvailablePortCount(),
      allocatedPorts: this.portManager.getAllocatedPorts()
    };
  }

  /**
   * Shutdown server
   */
  shutdown(): void {
    clearInterval(this.cleanupInterval);
    
    // Close all TCP servers
    this.tcpServers.forEach((server) => {
      server.close();
    });

    // Close all WebSocket connections
    this.clients.forEach((client) => {
      client.ws.close();
    });

    this.wss.close();
    console.log('Server shutdown complete');
  }
}