import { Module } from '@nestjs/common';
import { DigitalHumanController } from './digital-human.controller';
import { DigitalHumanService } from './digital-human.service';

@Module({
  controllers: [DigitalHumanController],
  providers: [DigitalHumanService],
  exports: [DigitalHumanService],
})
export class DigitalHumanModule {}
