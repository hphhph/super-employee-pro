import { Module } from '@nestjs/common';
import { CompetitorController } from './competitor.controller';
import { CompetitorService } from './competitor.service';

@Module({
  controllers: [CompetitorController],
  providers: [CompetitorService],
  exports: [CompetitorService],
})
export class CompetitorModule {}
