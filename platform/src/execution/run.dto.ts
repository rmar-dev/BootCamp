import { IsString, MinLength, MaxLength, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class RunDto {
  @IsString()
  @MinLength(1)
  exerciseId!: string;

  @IsInt()
  @Type(() => Number)
  exerciseVersion!: number;

  @IsString()
  @MaxLength(65536)
  code!: string;
}
