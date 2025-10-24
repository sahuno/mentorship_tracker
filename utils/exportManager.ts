import { Program, User, Milestone, Expense, BalanceSheetCycle, MilestoneStatus } from '../types';

export interface ProgramReportData {
  program: Program;
  manager: User | null;
  participants: User[];
  milestones: {
    participant: User;
    milestones: Milestone[];
  }[];
  expenses: {
    participant: User;
    cycles: BalanceSheetCycle[];
    totalSpent: number;
    totalBudget: number;
  }[];
  metrics: {
    totalParticipants: number;
    averageProgress: number;
    totalBudget: number;
    totalSpent: number;
    completedMilestones: number;
    totalMilestones: number;
    activeDays: number;
    completionRate: number;
  };
  topPerformers: {
    participant: User;
    completionRate: number;
  }[];
  needsAttention: {
    participant: User;
    reason: string;
  }[];
}

class ExportManager {
  /**
   * Export program report data as CSV
   */
  static exportProgramReportCSV(data: any): void {
    const csvData = this.generateProgramReportCSV(data);
    this.downloadFile(csvData, `program_report_${data.programInfo.name}_${Date.now()}.csv`, 'text/csv');
  }

  /**
   * Export program report data as JSON
   */
  static exportProgramReportJSON(data: any): void {
    const jsonData = JSON.stringify(data, null, 2);
    this.downloadFile(jsonData, `program_report_${data.programInfo.name}_${Date.now()}.json`, 'application/json');
  }

  /**
   * Export expenses as CSV
   */
  static exportExpensesCSV(expenses: Expense[], userName: string = 'export'): void {
    const csvData = this.generateExpensesCSV(expenses);
    this.downloadFile(csvData, `expenses_${userName}_${Date.now()}.csv`, 'text/csv');
  }

  /**
   * Export milestones as CSV
   */
  static exportMilestonesCSV(milestones: Milestone[], userName: string = 'export'): void {
    const csvData = this.generateMilestonesCSV(milestones);
    this.downloadFile(csvData, `milestones_${userName}_${Date.now()}.csv`, 'text/csv');
  }

  /**
   * Export participant progress summary
   */
  static exportParticipantProgressCSV(participants: Array<{
    participant: User;
    milestones: Milestone[];
    expenses: BalanceSheetCycle[];
  }>): void {
    const csvData = this.generateParticipantProgressCSV(participants);
    this.downloadFile(csvData, `participant_progress_${Date.now()}.csv`, 'text/csv');
  }

  /**
   * Generate CSV for program report from ReportsAnalytics component
   */
  private static generateProgramReportCSV(data: any): string {
    const lines: string[] = [];

    // Header information
    lines.push(`Program Report: ${data.programInfo.name}`);
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push(`Status: ${data.programInfo.status}`);
    lines.push('');

    // Summary Metrics
    lines.push('SUMMARY METRICS');
    lines.push('Metric,Value');
    lines.push(`Total Participants,${data.participants}`);
    lines.push(`Average Completion,${data.progress.averageCompletion}%`);
    lines.push(`Overall Completion,${data.progress.overallCompletion}%`);
    lines.push(`Total Budget,$${data.financial.totalBudget.toFixed(2)}`);
    lines.push(`Total Spent,$${data.financial.totalSpent.toFixed(2)}`);
    lines.push(`Budget Utilization,${data.financial.averageUtilization}%`);
    lines.push(`Milestones Completed,${data.milestones.completed}/${data.milestones.total}`);
    lines.push(`Program Progress,${data.timeline.programProgress}%`);
    lines.push(`Days Remaining,${data.timeline.daysRemaining}`);
    lines.push(`Days Elapsed,${data.timeline.daysElapsed}`);
    lines.push('');

    // Milestone Breakdown
    lines.push('MILESTONE BREAKDOWN');
    lines.push('Status,Count');
    lines.push(`Completed,${data.milestones.completed}`);
    lines.push(`In Progress,${data.milestones.inProgress}`);
    lines.push(`Not Started,${data.milestones.notStarted}`);
    lines.push(`Manager Assigned,${data.milestones.assigned}`);
    lines.push(`Self-Created,${data.milestones.selfCreated}`);
    lines.push('');

    // Engagement Metrics
    lines.push('ENGAGEMENT METRICS');
    lines.push('Metric,Value');
    lines.push(`Total Progress Reports,${data.engagement.totalReports}`);
    lines.push(`Avg Reports per Participant,${data.engagement.averageReportsPerParticipant}`);
    lines.push(`Active Participants,${data.engagement.activeParticipants}`);
    lines.push(`Inactive Participants,${data.engagement.inactiveParticipants}`);
    lines.push('');

    // Top Performers
    lines.push('TOP PERFORMERS');
    lines.push('Rank,Name,Email,Completion Rate');
    if (data.progress.topPerformers && data.progress.topPerformers.length > 0) {
      data.progress.topPerformers.forEach((performer: any, index: number) => {
        lines.push(`${index + 1},${performer.participant.name},${performer.participant.email},${performer.completionRate.toFixed(1)}%`);
      });
    } else {
      lines.push('No data available');
    }
    lines.push('');

    // Needs Attention
    lines.push('NEEDS ATTENTION');
    lines.push('Name,Email,Last Activity');
    if (data.progress.needsAttention && data.progress.needsAttention.length > 0) {
      data.progress.needsAttention.forEach((item: any) => {
        const lastActivity = item.lastActivity
          ? new Date(item.lastActivity).toLocaleDateString()
          : 'No activity';
        lines.push(`${item.participant.name},${item.participant.email},${lastActivity}`);
      });
    } else {
      lines.push('All participants are active');
    }
    lines.push('');

    // Financial Summary
    lines.push('FINANCIAL SUMMARY');
    lines.push('Metric,Value');
    lines.push(`Total Budget,$${data.financial.totalBudget.toFixed(2)}`);
    lines.push(`Total Spent,$${data.financial.totalSpent.toFixed(2)}`);
    lines.push(`Remaining Budget,$${(data.financial.totalBudget - data.financial.totalSpent).toFixed(2)}`);
    lines.push(`Participants Over Budget,${data.financial.overBudget}`);

    return lines.join('\n');
  }

  /**
   * Generate CSV for expenses
   */
  private static generateExpensesCSV(expenses: Expense[]): string {
    const lines: string[] = [];

    // Header
    lines.push('Date,Category,Item,Amount,Contact,Remarks,Has Receipt');

    // Data rows
    expenses.forEach(expense => {
      const hasReceipt = expense.receiptUrl ? 'Yes' : 'No';
      const contact = expense.contact || '';
      const remarks = expense.remarks || '';

      lines.push(
        `${expense.date},${expense.category},"${expense.item}",$${expense.amount.toFixed(2)},"${contact}","${remarks}",${hasReceipt}`
      );
    });

    // Summary
    const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    lines.push('');
    lines.push(`Total,,,${total.toFixed(2)},,,`);

    return lines.join('\n');
  }

  /**
   * Generate CSV for milestones
   */
  private static generateMilestonesCSV(milestones: Milestone[]): string {
    const lines: string[] = [];

    // Header
    lines.push('Title,Description,Status,Due Date,Completed Date,Progress Reports,Manager Feedback,Required,Can Decline');

    // Data rows
    milestones.forEach(milestone => {
      const status = milestone.status || MilestoneStatus.NOT_STARTED;
      const dueDate = milestone.dueDate || 'N/A';
      const completedDate = milestone.completedDate || 'N/A';
      const reportCount = milestone.progressReports?.length || 0;
      const feedbackCount = milestone.managerFeedback?.length || 0;
      const required = milestone.assignmentInfo?.isRequired ? 'Yes' : 'No';
      const canDecline = milestone.assignmentInfo?.canDecline ? 'Yes' : 'No';

      lines.push(
        `"${milestone.title}","${milestone.description}",${status},${dueDate},${completedDate},` +
        `${reportCount},${feedbackCount},${required},${canDecline}`
      );
    });

    return lines.join('\n');
  }

  /**
   * Generate CSV for participant progress
   */
  private static generateParticipantProgressCSV(participants: Array<{
    participant: User;
    milestones: Milestone[];
    expenses: BalanceSheetCycle[];
  }>): string {
    const lines: string[] = [];

    // Header
    lines.push('Participant Progress Report');
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push('');
    lines.push('Name,Email,Total Milestones,Completed,In Progress,Not Started,Completion %,Total Budget,Total Spent,Budget Used %');

    participants.forEach(({ participant, milestones, expenses }) => {
      const completed = milestones.filter(m => m.status === MilestoneStatus.COMPLETED).length;
      const inProgress = milestones.filter(m => m.status === MilestoneStatus.IN_PROGRESS).length;
      const notStarted = milestones.filter(m => m.status === MilestoneStatus.NOT_STARTED).length;
      const completionRate = milestones.length > 0 ? (completed / milestones.length) * 100 : 0;

      const totalBudget = expenses.reduce((sum, cycle) => sum + cycle.budget, 0);
      const totalSpent = expenses.reduce((sum, cycle) =>
        sum + cycle.expenses.reduce((expSum, exp) => expSum + exp.amount, 0), 0
      );
      const budgetUsed = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

      lines.push(
        `${participant.name},${participant.email},${milestones.length},${completed},${inProgress},` +
        `${notStarted},${completionRate.toFixed(1)}%,$${totalBudget.toFixed(2)},$${totalSpent.toFixed(2)},${budgetUsed.toFixed(1)}%`
      );
    });

    return lines.join('\n');
  }

  /**
   * Download file utility
   */
  private static downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();

    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Export audit log as CSV
   */
  static exportAuditLogCSV(logs: Array<{
    timestamp: string;
    action: string;
    managerId: string;
    managerName: string;
    targetUserId: string;
    targetUserName: string;
    details: any;
  }>): void {
    const lines: string[] = [];

    // Header
    lines.push('Timestamp,Action,Manager,Target User,Details');

    // Data rows
    logs.forEach(log => {
      const details = typeof log.details === 'string' ? log.details : JSON.stringify(log.details);
      lines.push(
        `${log.timestamp},"${log.action}","${log.managerName}","${log.targetUserName}","${details}"`
      );
    });

    const csvData = lines.join('\n');
    this.downloadFile(csvData, `audit_log_${Date.now()}.csv`, 'text/csv');
  }

  /**
   * Generate printable HTML report
   */
  static generatePrintableReport(data: any): void {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Program Report: ${data.programInfo.name}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; margin: 20px; }
          h1, h2, h3 { color: #333; }
          .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
          .metrics-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 20px 0; }
          .metric { background: #f5f5f5; padding: 15px; border-radius: 5px; }
          .metric-label { font-weight: bold; color: #666; }
          .metric-value { font-size: 1.5em; color: #333; margin-top: 5px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background-color: #f2f2f2; font-weight: bold; }
          .section { page-break-inside: avoid; margin: 30px 0; }
          @media print {
            .no-print { display: none; }
            body { margin: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Program Report: ${data.programInfo.name}</h1>
          <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>Status:</strong> ${data.programInfo.status}</p>
          <p><strong>Description:</strong> ${data.programInfo.description}</p>
        </div>

        <div class="section">
          <h2>Summary Metrics</h2>
          <div class="metrics-grid">
            <div class="metric">
              <div class="metric-label">Total Participants</div>
              <div class="metric-value">${data.participants}</div>
            </div>
            <div class="metric">
              <div class="metric-label">Average Progress</div>
              <div class="metric-value">${data.progress.averageCompletion}%</div>
            </div>
            <div class="metric">
              <div class="metric-label">Total Budget</div>
              <div class="metric-value">$${data.financial.totalBudget.toFixed(2)}</div>
            </div>
            <div class="metric">
              <div class="metric-label">Total Spent</div>
              <div class="metric-value">$${data.financial.totalSpent.toFixed(2)}</div>
            </div>
            <div class="metric">
              <div class="metric-label">Milestones Completed</div>
              <div class="metric-value">${data.milestones.completed}/${data.milestones.total}</div>
            </div>
            <div class="metric">
              <div class="metric-label">Completion Rate</div>
              <div class="metric-value">${data.progress.overallCompletion}%</div>
            </div>
          </div>
        </div>

        <div class="section">
          <h2>Top Performers</h2>
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Name</th>
                <th>Email</th>
                <th>Completion Rate</th>
              </tr>
            </thead>
            <tbody>
              ${data.progress.topPerformers && data.progress.topPerformers.length > 0 ?
                data.progress.topPerformers.map((performer: any, index: number) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td>${performer.participant.name}</td>
                    <td>${performer.participant.email}</td>
                    <td>${performer.completionRate.toFixed(1)}%</td>
                  </tr>
                `).join('') :
                '<tr><td colspan="4">No data available</td></tr>'
              }
            </tbody>
          </table>
        </div>

        <div class="section">
          <h2>Needs Attention</h2>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              ${data.progress.needsAttention && data.progress.needsAttention.length > 0 ?
                data.progress.needsAttention.map((item: any) => `
                  <tr>
                    <td>${item.participant.name}</td>
                    <td>${item.participant.email}</td>
                    <td>${item.lastActivity ? new Date(item.lastActivity).toLocaleDateString() : 'No activity'}</td>
                  </tr>
                `).join('') :
                '<tr><td colspan="3">All participants are active!</td></tr>'
              }
            </tbody>
          </table>
        </div>

        <div class="section">
          <h2>Financial Summary</h2>
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Total Budget</td>
                <td>$${data.financial.totalBudget.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Total Spent</td>
                <td>$${data.financial.totalSpent.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Remaining Budget</td>
                <td>$${(data.financial.totalBudget - data.financial.totalSpent).toFixed(2)}</td>
              </tr>
              <tr>
                <td>Budget Utilization</td>
                <td>${data.financial.averageUtilization}%</td>
              </tr>
              <tr>
                <td>Participants Over Budget</td>
                <td>${data.financial.overBudget}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="section">
          <h2>Engagement Metrics</h2>
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Total Progress Reports</td>
                <td>${data.engagement.totalReports}</td>
              </tr>
              <tr>
                <td>Avg Reports per Participant</td>
                <td>${data.engagement.averageReportsPerParticipant}</td>
              </tr>
              <tr>
                <td>Active Participants</td>
                <td>${data.engagement.activeParticipants}</td>
              </tr>
              <tr>
                <td>Inactive Participants</td>
                <td>${data.engagement.inactiveParticipants}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.print();
    }
  }
}

export default ExportManager;