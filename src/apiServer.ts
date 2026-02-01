import express, { Express, Request, Response } from 'express';
import { TunnelServer } from './tunnelServer';

export class APIServer {
  private app: Express;
  private tunnelServer: TunnelServer;
  private port: number;

  constructor(tunnelServer: TunnelServer, port: number = 3000) {
    this.tunnelServer = tunnelServer;
    this.port = port;
    this.app = express();

    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok' });
    });

    // Server statistics
    this.app.get('/stats', (req: Request, res: Response) => {
      const stats = this.tunnelServer.getStats();
      res.json(stats);
    });

    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        name: 'Minecraft Tunnel Server',
        version: '2.0.0',
        endpoints: {
          health: '/health',
          stats: '/stats'
        }
      });
    });
  }

  start(): void {
    this.app.listen(this.port, () => {
      console.log(`API server listening on port ${this.port}`);
    });
  }
}