import express, { Request, Response } from 'express';
import { TunnelServer } from './tunnelServer';

export class APIServer {
  private app: express.Application;
  private tunnelServer: TunnelServer;
  private port: number;

  constructor(tunnelServer: TunnelServer, port: number = 3000) {
    this.app = express();
    this.tunnelServer = tunnelServer;
    this.port = port;

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    
    // CORS middleware
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Get server statistics
    this.app.get('/stats', (req: Request, res: Response) => {
      const stats = this.tunnelServer.getStats();
      res.json(stats);
    });

    // Get detailed status
    this.app.get('/status', (req: Request, res: Response) => {
      const stats = this.tunnelServer.getStats();
      res.json({
        status: 'running',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        ...stats
      });
    });

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({ error: 'Not found' });
    });

    // Error handler
    this.app.use((err: Error, req: Request, res: Response, next: express.NextFunction) => {
      console.error('API error:', err);
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  start(): void {
    this.app.listen(this.port, () => {
      console.log(`API server listening on port ${this.port}`);
    });
  }
}
