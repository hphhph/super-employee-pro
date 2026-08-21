import { Module } from '@nestjs/common';
import { WecomController } from './wecom.controller';
import { WecomService } from './wecom.service';

@Module({
  controllers: [WecomController],
  providers: [WecomService],
  exports: [WecomService],
})
export class WecomModule {}
