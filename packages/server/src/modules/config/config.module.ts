import { Module } from '@nestjs/common';
import { ConfigCenterController } from './config.controller';
import { RuntimeKeysController } from './runtime-keys.controller';
import { ConfigCenterService } from './config.service';

@Module({
  controllers: [ConfigCenterController, RuntimeKeysController],
  providers: [ConfigCenterService],
  exports: [ConfigCenterService],
})
export class ConfigCenterModule {}
