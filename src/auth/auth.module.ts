import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { SocketAuthService } from './socket-auth.service';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  providers: [JwtStrategy, SocketAuthService],
  exports: [PassportModule, SocketAuthService],
})
export class AuthModule {}
