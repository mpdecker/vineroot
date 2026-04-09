import { Global, Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';

/** Single WebSocket gateway instance for the whole app (avoid duplicate @WebSocketGateway registrations). */
@Global()
@Module({
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class CommonModule {}
