import {
  IsNotEmpty,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { ROOM_CODE_LENGTH } from '../versus.constants';

export class VersusCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  category!: string;
}

export class JoinRoomDto {
  @IsString()
  @Length(ROOM_CODE_LENGTH, ROOM_CODE_LENGTH)
  @Matches(/^[A-Za-z0-9]+$/, { message: 'code must be letters or digits' })
  code!: string;
}

export class VersusStatsDto {
  wins!: number;
  losses!: number;
  draws!: number;
}
