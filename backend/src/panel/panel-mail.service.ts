import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { PanelFinalReport } from './panel-session.entity';

@Injectable()
export class PanelMailService {
  private readonly logger = new Logger(PanelMailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly cfg: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: cfg.get<string>('mail.host') ?? 'smtp.gmail.com',
      port: cfg.get<number>('mail.port') ?? 587,
      secure: false,
      auth: {
        user: cfg.get<string>('mail.user') ?? '',
        pass: cfg.get<string>('mail.pass') ?? '',
      },
    });
  }

  async sendInterviewReport(opts: {
    to: string;
    candidateName: string;
    sessionId: string;
    report: PanelFinalReport;
    abandoned: boolean;
    questionsAsked: number;
    questionsAnswered: number;
    questionsSkipped: number;
  }): Promise<void> {
    const {
      to, candidateName, sessionId, report,
      abandoned, questionsAsked, questionsAnswered, questionsSkipped,
    } = opts;

    // Don't crash if mail isn't configured — just log
    if (!this.cfg.get<string>('mail.user')) {
      this.logger.warn(`Mail not configured — skipping report email to ${to}`);
      return;
    }

    const scoreColor = report.overallScore >= 70 ? '#22c55e' : report.overallScore >= 40 ? '#eab308' : '#ef4444';
    const passLabel = report.passed ? '✅ PASSED' : '❌ NOT PASSED';
    const statusBanner = abandoned
      ? `<div style="background:#7f1d1d;border-radius:8px;padding:12px 20px;margin-bottom:20px;color:#fca5a5;font-weight:600;">
          ⚠️ Interview was exited early — ${questionsAnswered}/${questionsAsked} questions answered (${questionsSkipped} skipped)
        </div>`
      : '';

    const sectionRows = (report.sectionScores ?? [])
      .map((s) => `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #334155;color:#cbd5e1">${s.section}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #334155;text-align:center;color:#94a3b8">${s.score}/${s.maxScore}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #334155;text-align:center;color:${s.percentage >= 70 ? '#22c55e' : s.percentage >= 40 ? '#eab308' : '#ef4444'}">${s.percentage}%</td>
      </tr>`).join('');

    const breakdownRows = (report.questionBreakdown ?? [])
      .map((q, i) => `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #334155;color:#94a3b8;font-size:12px">Q${i + 1}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #334155;color:#cbd5e1;font-size:12px">${q.questionText.slice(0, 80)}${q.questionText.length > 80 ? '…' : ''}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #334155;text-align:center;color:${q.score >= 7 ? '#22c55e' : q.score >= 4 ? '#eab308' : '#ef4444'};font-weight:700">${q.score}/${q.maxScore}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #334155;color:#94a3b8;font-size:11px">${q.feedback ?? ''}</td>
      </tr>`).join('');

    const strengths = (report.strengths ?? []).map((s) => `<li style="margin-bottom:4px;color:#86efac">✅ ${s}</li>`).join('');
    const weakAreas = (report.weakAreas ?? []).map((s) => `<li style="margin-bottom:4px;color:#fca5a5">⚠️ ${s}</li>`).join('');
    const tips = (report.interviewTips ?? []).map((s) => `<li style="margin-bottom:4px;color:#93c5fd">💡 ${s}</li>`).join('');

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:20px;">
  <div style="max-width:700px;margin:0 auto;background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#312e81,#1e1b4b);padding:32px;text-align:center;">
      <div style="font-size:32px;margin-bottom:8px;">🎙️</div>
      <h1 style="color:#e0e7ff;margin:0 0 4px;font-size:22px;">Panel Interview Report</h1>
      <p style="color:#a5b4fc;margin:0;font-size:14px;">AI Interview Bot · ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </div>

    <div style="padding:28px;">
      ${statusBanner}

      <!-- Profile -->
      <div style="background:#0f172a;border-radius:10px;padding:16px;margin-bottom:24px;border:1px solid #334155;">
        <p style="margin:0 0 8px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Candidate</p>
        <h2 style="color:#e2e8f0;margin:0 0 8px;font-size:20px;">${candidateName}</h2>
        <div style="display:flex;gap:16px;flex-wrap:wrap;">
          <span style="color:#64748b;font-size:13px;">📚 ${report.candidateProfile?.track ?? ''}</span>
          <span style="color:#64748b;font-size:13px;">⏱ ${report.candidateProfile?.experienceYears ?? ''} yrs exp</span>
          <span style="color:#64748b;font-size:13px;">💼 ${report.candidateProfile?.role ?? ''}</span>
          <span style="color:#64748b;font-size:13px;">⚡ ${report.candidateProfile?.difficulty ?? ''}</span>
        </div>
      </div>

      <!-- Overall Score -->
      <div style="text-align:center;margin-bottom:28px;background:#0f172a;border-radius:12px;padding:24px;border:1px solid #334155;">
        <div style="font-size:52px;font-weight:900;color:${scoreColor};line-height:1;">${report.overallScore}%</div>
        <div style="font-size:18px;font-weight:700;color:#e2e8f0;margin-top:8px;">${passLabel}</div>
        <div style="margin-top:12px;background:#1e293b;border-radius:999px;height:8px;overflow:hidden;">
          <div style="height:100%;background:${scoreColor};width:${report.overallScore}%;border-radius:999px;"></div>
        </div>
        ${abandoned ? `<p style="color:#f87171;font-size:13px;margin-top:12px;">Score calculated from ${questionsAnswered} answered + ${questionsSkipped} skipped out of ${questionsAsked} total questions</p>` : ''}
      </div>

      <!-- Section Scores -->
      ${sectionRows ? `
      <h3 style="color:#e2e8f0;margin:0 0 12px;font-size:16px;">📊 Section Breakdown</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;background:#0f172a;border-radius:10px;overflow:hidden;border:1px solid #334155;">
        <thead><tr style="background:#1e293b;">
          <th style="padding:10px 12px;text-align:left;color:#64748b;font-size:12px;text-transform:uppercase;">Section</th>
          <th style="padding:10px 12px;text-align:center;color:#64748b;font-size:12px;text-transform:uppercase;">Score</th>
          <th style="padding:10px 12px;text-align:center;color:#64748b;font-size:12px;text-transform:uppercase;">%</th>
        </tr></thead>
        <tbody>${sectionRows}</tbody>
      </table>` : ''}

      <!-- Strengths & Weak Areas -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
        <div style="background:#0f172a;border-radius:10px;padding:16px;border:1px solid #166534;">
          <h4 style="color:#4ade80;margin:0 0 10px;font-size:14px;">💪 Strengths</h4>
          <ul style="margin:0;padding-left:0;list-style:none;">${strengths || '<li style="color:#4b5563;font-size:13px;">None recorded</li>'}</ul>
        </div>
        <div style="background:#0f172a;border-radius:10px;padding:16px;border:1px solid #7f1d1d;">
          <h4 style="color:#f87171;margin:0 0 10px;font-size:14px;">🎯 Improvement Areas</h4>
          <ul style="margin:0;padding-left:0;list-style:none;">${weakAreas || '<li style="color:#4b5563;font-size:13px;">None recorded</li>'}</ul>
        </div>
      </div>

      <!-- Improvement Plan -->
      ${report.improvementPlan ? `
      <div style="background:#0f172a;border-radius:10px;padding:16px;margin-bottom:24px;border:1px solid #334155;">
        <h4 style="color:#818cf8;margin:0 0 10px;font-size:14px;">📈 Improvement Plan</h4>
        <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0;">${report.improvementPlan}</p>
      </div>` : ''}

      <!-- Interview Tips -->
      ${tips ? `
      <div style="background:#0f172a;border-radius:10px;padding:16px;margin-bottom:24px;border:1px solid #334155;">
        <h4 style="color:#60a5fa;margin:0 0 10px;font-size:14px;">💡 Interview Tips</h4>
        <ul style="margin:0;padding-left:0;list-style:none;">${tips}</ul>
      </div>` : ''}

      <!-- Question Breakdown -->
      ${breakdownRows ? `
      <h3 style="color:#e2e8f0;margin:0 0 12px;font-size:16px;">🗂 Question-by-Question</h3>
      <table style="width:100%;border-collapse:collapse;background:#0f172a;border-radius:10px;overflow:hidden;border:1px solid #334155;">
        <thead><tr style="background:#1e293b;">
          <th style="padding:10px 12px;text-align:left;color:#64748b;font-size:11px;">#</th>
          <th style="padding:10px 12px;text-align:left;color:#64748b;font-size:11px;">Question</th>
          <th style="padding:10px 12px;text-align:center;color:#64748b;font-size:11px;">Score</th>
          <th style="padding:10px 12px;text-align:left;color:#64748b;font-size:11px;">Feedback</th>
        </tr></thead>
        <tbody>${breakdownRows}</tbody>
      </table>` : ''}

    </div>

    <!-- Footer -->
    <div style="background:#0f172a;padding:20px;text-align:center;border-top:1px solid #334155;">
      <p style="color:#475569;font-size:12px;margin:0;">Session ID: ${sessionId}</p>
      <p style="color:#475569;font-size:12px;margin:4px 0 0;">Generated by AI Interview Bot · Powered by GPT-4o</p>
    </div>
  </div>
</body>
</html>`;

    const subject = abandoned
      ? `📋 Your Panel Interview Report (Early Exit) — ${report.overallScore}% — ${report.candidateProfile?.track ?? ''}`
      : `🎉 Your Panel Interview Report — ${report.overallScore}% — ${passLabel}`;

    try {
      await this.transporter.sendMail({
        from: this.cfg.get<string>('mail.from'),
        to,
        subject,
        html,
      });
      this.logger.log(`Report email sent to ${to}`);
    } catch (err) {
      this.logger.error(`Failed to send report email to ${to}`, err);
      // Don't throw — email is best-effort
    }
  }
}
