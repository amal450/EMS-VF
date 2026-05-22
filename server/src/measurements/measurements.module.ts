import { Module } from '@nestjs/common';
import { MeasurementsService } from './measurements.service';
import { MeasurementsController } from './measurements.controller';
import { RealTimeBridgeService } from './real-time-bridge.service'; // <--- IMPORT DU NOUVEAU SERVICE
import { AssetsModule } from '../assets/assets.module';

@Module({
  imports: [AssetsModule],
  controllers: [MeasurementsController],
  providers: [
    MeasurementsService, 
    RealTimeBridgeService // <--- DÉCLARATION DU SERVICE POUR L'ACTIVER
  ],
  exports: [MeasurementsService]
})
export class MeasurementsModule {}
