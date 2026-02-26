import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  IntegrityEvent,
  IntegrityEventType,
  IntegritySeverity,
} from './integrity-event.entity';
import { InterviewSession } from '../interviews/interview-session.entity';
import { RecordIntegrityEventDto } from './dto/integrity.dto';

const SEVERITY_MAP: Record<IntegrityEventType, IntegritySeverity> = {
  [IntegrityEventType.TAB_SWITCH]: IntegritySeverity.MEDIUM,
  [IntegrityEventType.WINDOW_BLUR]: IntegritySeverity.LOW,
  [IntegrityEventType.COPY_PASTE]: IntegritySeverity.MEDIUM,
  [IntegrityEventType.DEVTOOLS_OPEN]: IntegritySeverity.HIGH,
  [IntegrityEventType.TIME_ANOMALY]: IntegritySeverity.HIGH,
  [IntegrityEventType.RAPID_ANSWER]: IntegritySeverity.MEDIUM,
  [IntegrityEventType.INACTIVITY]: IntegritySeverity.LOW,
  [IntegrityEventType.SCREENSHOT_ATTEMPT]: IntegritySeverity.HIGH,
};

const FLAG_THRESHOLD = 5; // auto-flag session after this many events

@Injectable()
export class IntegrityService {
  constructor(
    @InjectRepository(IntegrityEvent)
    private readonly eventsRepo: Repository<IntegrityEvent>,
    @InjectRepository(InterviewSession)
    private readonly sessionsRepo: Repository<InterviewSession>,
  ) {}

  async recordEvent(
    sessionId: string,
    dto: RecordIntegrityEventDto,
  ): Promise<IntegrityEvent> {
    const severity = SEVERITY_MAP[dto.eventType] ?? IntegritySeverity.LOW;

    const event = this.eventsRepo.create({
      sessionId,
      eventType: dto.eventType,
      severity,
      questionId: dto.questionId,
      metadata: dto.metadata,
    });
    const saved = await this.eventsRepo.save(event);

    // Update session counter and auto-flag
    const session = await this.sessionsRepo.findOne({
      where: { id: sessionId },
    });
    if (session) {
      let tabCount = session.tabSwitchCount;
      let copyCount = session.copyPasteCount;
      let flagged = session.isIntegrityFlagged;

      if (dto.eventType === IntegrityEventType.TAB_SWITCH) tabCount += 1;
      if (dto.eventType === IntegrityEventType.COPY_PASTE) copyCount += 1;

      const totalEvents = await this.eventsRepo.count({ where: { sessionId } });
      if (totalEvents >= FLAG_THRESHOLD && !flagged) flagged = true;

      await this.sessionsRepo.update(sessionId, {
        tabSwitchCount: tabCount,
        copyPasteCount: copyCount,
        isIntegrityFlagged: flagged,
      });
    }

    return saved;
  }

  async getEventsForSession(sessionId: string): Promise<IntegrityEvent[]> {
    return this.eventsRepo.find({
      where: { sessionId },
      order: { occurredAt: 'ASC' },
    });
  }
}
