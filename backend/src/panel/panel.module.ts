import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PanelSession } from './panel-session.entity';
import { PanelAiService } from './panel-ai.service';
import { PanelService } from './panel.service';
import { PanelController } from './panel.controller';
import { PanelMailService } from './panel-mail.service';
import { User } from '../users/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PanelSession, User])],
  providers: [PanelAiService, PanelService, PanelMailService],
  controllers: [PanelController],
  exports: [PanelService],
})
export class PanelModule {}
