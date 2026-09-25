import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { HeroesModule } from './heroes/heroes.module';
import { PlayersModule } from './players/players.module';
import { LevelsModule } from './levels/levels.module';
import { QuestionsModule } from './questions/questions.module';
import { GamesModule } from './games/games.module';
import { buildDataSourceOptions } from './db/data-source-options';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...buildDataSourceOptions({
          DATABASE_URL: config.get<string>('DATABASE_URL'),
          DB_HOST: config.get<string>('DB_HOST'),
          DB_PORT: config.get<string>('DB_PORT'),
          DB_USERNAME: config.get<string>('DB_USERNAME'),
          DB_PASSWORD: config.get<string>('DB_PASSWORD'),
          DB_NAME: config.get<string>('DB_NAME'),
          DB_SSL: config.get<string>('DB_SSL'),
        }),
        // Entities come from each module's forFeature; migrations run in
        // db/setup.ts before the app starts.
        entities: [],
        migrations: [],
        autoLoadEntities: true,
      }),
    }),
    AuthModule,
    HeroesModule,
    PlayersModule,
    LevelsModule,
    QuestionsModule,
    GamesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
