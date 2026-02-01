import { WebSocket } from 'ws';

export interface TunnelClient {
  id: string;
  ws: WebSocket;
  assignedPort: number;
  minecraftServerPort: number;
  createdAt: Date;
  lastActivity: Date;
}

export interface PortAllocation {
  port: number;
  clientId: string;
  allocated: boolean;
}

export interface TunnelMessage {
  type: 'register' | 'data' | 'close' | 'ping' | 'pong' | 'error';
  clientId?: string;
  port?: number;
  data?: Buffer | string;
  error?: string;
}

export interface ServerConfig {
  port: number;
  minTunnelPort: number;
  maxTunnelPort: number;
  maxClients: number;
  idleTimeout: number; // milliseconds
}
