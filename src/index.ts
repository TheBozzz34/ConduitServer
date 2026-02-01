import dotenv from 'dotenv';
import { TunnelServer } from './tunnelServer';
import { APIServer } from './apiServer';

// Load environment variables
dotenv.config();

const WS_PORT = parseInt(process.env.WS_PORT || '8080');
const API_PORT = parseInt(process.env.API_PORT || '3000');
const ENABLE_API = process.env.ENABLE_API !== 'false';

console.log('Starting Minecraft Tunnel Server...');
console.log('Configuration:', {
  wsPort: WS_PORT,
  apiPort: API_PORT,
  apiEnabled: ENABLE_API
});

// Create and start tunnel server
const tunnelServer = new TunnelServer();

// Optionally start API server for monitoring
if (ENABLE_API) {
  const apiServer = new APIServer(tunnelServer, API_PORT);
  apiServer.start();
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

console.log('Server started successfully!');