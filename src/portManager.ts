import { PortAllocation } from './types';

export class PortManager {
  private allocatedPorts: Map<number, string> = new Map();
  private minPort: number;
  private maxPort: number;

  constructor(minPort: number, maxPort: number) {
    this.minPort = minPort;
    this.maxPort = maxPort;
  }

  /**
   * Allocate a port for a client
   */
  allocatePort(clientId: string): number | null {
    for (let port = this.minPort; port <= this.maxPort; port++) {
      if (!this.allocatedPorts.has(port)) {
        this.allocatedPorts.set(port, clientId);
        console.log(`Port ${port} allocated to client ${clientId}`);
        return port;
      }
    }
    console.error('No available ports');
    return null;
  }

  /**
   * Release a port
   */
  releasePort(port: number): void {
    if (this.allocatedPorts.has(port)) {
      const clientId = this.allocatedPorts.get(port);
      this.allocatedPorts.delete(port);
      console.log(`Port ${port} released from client ${clientId}`);
    }
  }

  /**
   * Get client ID for a port
   */
  getClientForPort(port: number): string | undefined {
    return this.allocatedPorts.get(port);
  }

  /**
   * Get all allocated ports
   */
  getAllocatedPorts(): PortAllocation[] {
    const ports: PortAllocation[] = [];
    this.allocatedPorts.forEach((clientId, port) => {
      ports.push({
        port,
        clientId,
        allocated: true
      });
    });
    return ports;
  }

  /**
   * Get available port count
   */
  getAvailablePortCount(): number {
    return (this.maxPort - this.minPort + 1) - this.allocatedPorts.size;
  }
}
