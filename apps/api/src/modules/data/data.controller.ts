import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Headers,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Workspace } from '@ledgerly/shared';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { CurrentWorkspace } from '../../common/workspace.decorator';
import type { AppRequest } from '../../common/types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DataService } from './data.service';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

@Controller('data')
export class DataController {
  constructor(private readonly dataService: DataService) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MARKETING_DIRECTOR')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async upload(
    @CurrentWorkspace() workspace: Workspace,
    @Req() request: AppRequest,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded (expected multipart field "file").');
    if (!file.originalname.toLowerCase().endsWith('.csv')) {
      throw new BadRequestException('Only .csv files are accepted.');
    }
    if (!request.actor) throw new ForbiddenException();

    return this.dataService.upload(workspace, file.originalname, file.buffer, request.actor);
  }

  @Post('ingest')
  async ingest(
    @CurrentWorkspace() workspace: Workspace,
    @Headers('x-ingest-key') ingestKey: string | undefined,
    @Body() body: { rows?: Array<Record<string, unknown>> },
  ) {
    if (ingestKey !== process.env.INGEST_API_KEY) {
      throw new ForbiddenException('Invalid ingest key.');
    }
    if (workspace !== 'LIVE') {
      throw new ForbiddenException('Ingest is LIVE only.');
    }
    if (!Array.isArray(body.rows)) {
      throw new BadRequestException('Body must be { rows: [...] }.');
    }
    return this.dataService.ingest(workspace, body.rows);
  }

  @Get('metrics')
  getMetrics(
    @CurrentWorkspace() workspace: Workspace,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('channel') channel?: string,
  ) {
    return this.dataService.getMetrics(workspace, from, to, channel);
  }

  @Get('summary')
  getSummary(@CurrentWorkspace() workspace: Workspace) {
    return this.dataService.getSummary(workspace);
  }

  @Get('sample-csv')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="ledgerly-sample.csv"')
  getSampleCsv() {
    return this.dataService.generateSampleCsv();
  }
}
