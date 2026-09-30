
import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({ cors: true })
export class RideGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const authHeader = client.handshake.headers.authorization;
      let token = client.handshake.auth?.token;
      
      if (!token && authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_ACCESS_SECRET || 'dev-secret-key-fallback'
      });

      client.data.user = payload;
      client.join(`user_${payload.sub}`);
      if (payload.driverId) {
        client.join(`driver_${payload.driverId}`);
      }
    } catch (e) {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {}

  emitRideStatusChanged(rideId: string, passengerId: string, status: string, stateVersion: number, driverId?: string) {
    const payload = { rideId, status, stateVersion, updatedAt: new Date().toISOString() };
    this.server.to(`user_${passengerId}`).emit('ride_status_changed', payload);
    if (driverId) {
      this.server.to(`driver_${driverId}`).emit('ride_status_changed', payload);
    }
  }
}
