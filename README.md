# Minecraft Tunnel Backend

A backend service that runs on a publicly accessible VPS to provide port tunneling for Minecraft servers, allowing players to host servers without port forwarding.

## Overview

This system creates a tunnel between:
1. **Plugin Client** - Runs on the player's Minecraft server (local machine)
2. **Tunnel Backend** - Runs on your VPS (this service)
3. **Minecraft Players** - Connect to the VPS IP and assigned port

## Architecture

```
[Player's Minecraft Client] 
        ↓
[VPS Public IP:AssignedPort] ← TCP Server
        ↓
[WebSocket Tunnel]
        ↓
[Plugin on Local Server] → [Local Minecraft Server:25565]
```

## Features

- **Automatic Port Allocation**: Dynamically assigns ports to connecting clients
- **WebSocket-based Tunneling**: Efficient bidirectional communication
- **Port Management**: Tracks and manages available ports
- **Idle Connection Cleanup**: Automatically removes inactive tunnels
- **REST API**: Monitor server status and statistics
- **Type-safe**: Written in TypeScript
- **Scalable**: Supports multiple concurrent tunnels

## Installation

### Prerequisites
- Node.js 18+ and npm
- A VPS with a public IP address
- Open ports on your VPS firewall

### Setup

1. **Clone or upload the project to your VPS**

2. **Install dependencies**:
```bash
npm install
```

3. **Configure environment variables**:
```bash
cp .env.example .env
nano .env
```

Edit the configuration:
- `WS_PORT`: WebSocket server port (default: 8080)
- `API_PORT`: REST API port (default: 3000)
- `MIN_TUNNEL_PORT`: Starting port for tunnels (default: 25600)
- `MAX_TUNNEL_PORT`: Ending port for tunnels (default: 25700)
- `MAX_CLIENTS`: Maximum concurrent tunnels (default: 100)
- `IDLE_TIMEOUT`: Timeout for idle connections in ms (default: 300000)

4. **Build the project**:
```bash
npm run build
```

5. **Start the server**:
```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

## Firewall Configuration

Make sure to open these ports on your VPS:

```bash
# WebSocket port
sudo ufw allow 8080/tcp

# API port
sudo ufw allow 3000/tcp

# Tunnel port range
sudo ufw allow 25600:25700/tcp
```

For iptables:
```bash
sudo iptables -A INPUT -p tcp --dport 8080 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 25600:25700 -j ACCEPT
sudo iptables-save
```

## Running as a Service

### Using systemd (recommended for production)

Create a service file:
```bash
sudo nano /etc/systemd/system/minecraft-tunnel.service
```

Add the following:
```ini
[Unit]
Description=Minecraft Tunnel Backend
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/minecraft-tunnel-backend
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable minecraft-tunnel
sudo systemctl start minecraft-tunnel
sudo systemctl status minecraft-tunnel
```

View logs:
```bash
sudo journalctl -u minecraft-tunnel -f
```

### Using PM2

```bash
npm install -g pm2
pm2 start dist/index.js --name minecraft-tunnel
pm2 save
pm2 startup
```

## API Endpoints

### GET /health
Health check endpoint
```bash
curl http://your-vps-ip:3000/health
```

### GET /stats
Get current server statistics
```bash
curl http://your-vps-ip:3000/stats
```

Response:
```json
{
  "activeClients": 5,
  "availablePorts": 95,
  "allocatedPorts": [
    {"port": 25600, "clientId": "abc-123", "allocated": true}
  ]
}
```

### GET /status
Get detailed server status including memory usage
```bash
curl http://your-vps-ip:3000/status
```

## Protocol Documentation

### Client → Server Messages

**Register Tunnel**:
```json
{
  "type": "register",
  "port": 25565
}
```

**Ping**:
```json
{
  "type": "ping"
}
```

**Data** (Minecraft packet from local server):
```json
{
  "type": "data",
  "data": "base64-encoded-data"
}
```

### Server → Client Messages

**Registration Response**:
```json
{
  "type": "register",
  "clientId": "uuid",
  "port": 25600
}
```

**Pong**:
```json
{
  "type": "pong"
}
```

**Data** (Minecraft packet from player):
```json
{
  "type": "data",
  "data": "base64-encoded-data"
}
```

**Error**:
```json
{
  "type": "error",
  "error": "Error message"
}
```

## Monitoring

Check active connections:
```bash
curl http://your-vps-ip:3000/stats | jq
```

Monitor logs:
```bash
# systemd
sudo journalctl -u minecraft-tunnel -f

# PM2
pm2 logs minecraft-tunnel
```

## Security Considerations

1. **Rate Limiting**: Consider implementing rate limiting on the WebSocket server
2. **Authentication**: Add authentication for production use
3. **DDoS Protection**: Use services like Cloudflare or implement connection limits
4. **Firewall**: Only open necessary ports
5. **Updates**: Keep dependencies updated with `npm audit`

## Performance Tuning

For high traffic:

1. **Increase file descriptors**:
```bash
ulimit -n 65535
```

2. **Adjust system limits** in `/etc/security/limits.conf`:
```
* soft nofile 65535
* hard nofile 65535
```

3. **Optimize Node.js**:
```bash
NODE_OPTIONS="--max-old-space-size=4096" npm start
```

## Troubleshooting

### Port already in use
```bash
# Check what's using the port
sudo lsof -i :8080
# Kill the process if needed
sudo kill -9 <PID>
```

### WebSocket connection fails
- Check firewall rules
- Verify the VPS IP is accessible
- Check if the service is running: `systemctl status minecraft-tunnel`

### High memory usage
- Reduce `MAX_CLIENTS` in .env
- Implement stricter cleanup of idle connections
- Monitor with: `curl http://your-vps-ip:3000/status`

## Next Steps

After getting the backend running, you'll need to:

1. **Develop the Minecraft plugin** that connects to this backend
2. **Test the tunnel** with a local Minecraft server
3. **Set up monitoring and alerting** for production use
4. **Consider load balancing** for multiple VPS instances

## License

MIT
