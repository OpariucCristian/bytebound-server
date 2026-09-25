import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly dataSource: DataSource,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * The client pings this as soon as someone opens the site. Touching the
   * database also wakes Neon, so both are ready by the time they press play.
   */
  @Get('api/health')
  async getHealth(): Promise<{ status: 'ok' }> {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ok' };
    } catch {
      throw new ServiceUnavailableException('Database is not reachable');
    }
  }
}
