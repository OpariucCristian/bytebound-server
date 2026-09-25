import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { GuestJwtStrategy } from './guest.strategy';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  providers: [JwtStrategy, GuestJwtStrategy],
  exports: [PassportModule],
})
export class AuthModule {}
