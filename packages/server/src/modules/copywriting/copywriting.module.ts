import { Module } from '@nestjs/common';
import { CopywritingController } from './copywriting.controller';
import { CopywritingService } from './copywriting.service';
import { DeepSeekClient } from '../../common/deepseek/deepseek.client';

@Module({
  controllers: [CopywritingController],
  providers: [CopywritingService, DeepSeekClient],
  exports: [CopywritingService],
})
export class CopywritingModule {}
