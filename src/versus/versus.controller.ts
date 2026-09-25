import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { PLAYER_AUTH } from '../auth/guest';
import { getUserIdFromToken } from '../utils/utils';
import { VersusStatsDto } from './dto/versus.dto';
import { VersusService } from './versus.service';
import { MatchSummary } from './versus.types';

@UseGuards(AuthGuard(PLAYER_AUTH))
@Controller('api/versus')
export class VersusController {
  constructor(private readonly versusService: VersusService) {}

  // GET: api/versus/stats
  @Get('stats')
  getStats(@Req() req: Request): Promise<VersusStatsDto> {
    return this.versusService.getStats(this.requireUserId(req));
  }

  // GET: api/versus/match/:id
  @Get('match/:id')
  getMatch(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<MatchSummary> {
    return this.versusService.getMatch(id, this.requireUserId(req));
  }

  private requireUserId(req: Request): string {
    const userId = getUserIdFromToken(req);
    if (!userId) {
      throw new UnauthorizedException('User ID not found in claims');
    }
    return userId;
  }
}
