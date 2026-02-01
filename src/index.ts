import dotenv from 'dotenv';
import { TunnelServer } from './tunnelServer';
import { APIServer } from './apiServer';
import { ServerConfig } from './types';

// Load environment variables
dotenv.config();

// Configuration
const config: ServerConfig = {
  port: parseInt(process.env.WS_PORT || '8080'),
  minTunnelPort: parseInt(process.env.MIN_TUNNEL_PORT || '25600'),
  maxTunnelPort: parseInt(process.env.MAX_TUNNEL_PORT || '25700'),
  maxClients: parseInt(process.env.MAX_CLIENTS || '100'),
  idleTimeout: parseInt(process.env.IDLE_TIMEOUT || '300000') // 5 minutes default
};

console.log('Starting Minecraft Tunnel Server...');
console.log('Configuration:', {
  wsPort: config.port,
  tunnelPortRange: `${config.minTunnelPort}-${config.maxTunnelPort}`,
  maxClients: config.maxClients,
  idleTimeout: `${config.idleTimeout / 1000}s`
});

// Create servers
const tunnelServer = new TunnelServer(config);
const apiServer = new APIServer(
  tunnelServer, 
  parseInt(process.env.API_PORT || '3000')
);

// Start API server
apiServer.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  tunnelServer.shutdown();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  tunnelServer.shutdown();
  process.exit(0);
});

console.log('Server started successfully!');
