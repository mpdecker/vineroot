import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';
import { SocketEvent, SocketEventType } from '@vineroot/shared-types';

@Injectable()
@WebSocketGateway({
  namespace: '/events',
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
})
export class EventsGateway {
  @WebSocketServer()
  server: Server;

  private userSockets: Map<string, Set<string>> = new Map();

  @SubscribeMessage('join:workspace')
  handleJoinWorkspace(
    @ConnectedSocket() client: Socket,
    data: { workspaceId: string; userId: string },
  ) {
    const roomName = `workspace:${data.workspaceId}`;
    client.join(roomName);

    if (!this.userSockets.has(data.userId)) {
      this.userSockets.set(data.userId, new Set());
    }
    this.userSockets.get(data.userId).add(client.id);

    this.emitPresence(data.userId, data.workspaceId, 'online');
  }

  @SubscribeMessage('join:task')
  handleJoinTask(
    @ConnectedSocket() client: Socket,
    data: { taskId: string; workspaceId: string },
  ) {
    const roomName = `task:${data.taskId}`;
    client.join(roomName);
  }

  @SubscribeMessage('leave:workspace')
  handleLeaveWorkspace(
    @ConnectedSocket() client: Socket,
    data: { workspaceId: string; userId: string },
  ) {
    const roomName = `workspace:${data.workspaceId}`;
    client.leave(roomName);

    const userSockets = this.userSockets.get(data.userId);
    if (userSockets) {
      userSockets.delete(client.id);
      if (userSockets.size === 0) {
        this.userSockets.delete(data.userId);
        this.emitPresence(data.userId, data.workspaceId, 'offline');
      }
    }
  }

  emitToWorkspace<T>(
    workspaceId: string,
    eventType: SocketEventType,
    data: T,
  ): void {
    const event: SocketEvent<T> = {
      type: eventType,
      data,
      timestamp: new Date(),
      workspaceId,
    };
    this.server.to(`workspace:${workspaceId}`).emit('event', event);
  }

  emitToTask<T>(
    taskId: string,
    workspaceId: string,
    eventType: SocketEventType,
    data: T,
  ): void {
    const event: SocketEvent<T> = {
      type: eventType,
      data,
      timestamp: new Date(),
      workspaceId,
    };
    this.server.to(`task:${taskId}`).emit('event', event);
  }

  emitToUser<T>(
    userId: string,
    workspaceId: string,
    eventType: SocketEventType,
    data: T,
  ): void {
    const event: SocketEvent<T> = {
      type: eventType,
      data,
      timestamp: new Date(),
      workspaceId,
    };
    const userSockets = this.userSockets.get(userId);
    if (userSockets) {
      userSockets.forEach((socketId) => {
        this.server.to(socketId).emit('event', event);
      });
    }
  }

  private emitPresence(
    userId: string,
    workspaceId: string,
    status: 'online' | 'offline',
  ): void {
    this.server.to(`workspace:${workspaceId}`).emit('presence', {
      userId,
      status,
      timestamp: new Date(),
    });
  }
}
