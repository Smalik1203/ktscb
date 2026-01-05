/**
 * Finance Export Service
 * 
 * CSV export and PDF report generation for finance transactions.
 * Phase 6: Reporting & Export
 */

import { supabase } from '../lib/supabase';
import { log } from '../lib/logger';
import { financeService, financeReportsService } from './finance';
import type { FinanceTransaction } from './finance';
import { format } from 'date-fns';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { documentDirectory, writeAsStringAsync, moveAsync, EncodingType } from 'expo-file-system/legacy';
import { Alert } from 'react-native';

/**
 * Log export operation to audit trail
 */
async function logExportOperation(
  schoolCode: string,
  exportType: 'csv' | 'pdf',
  startDate: string,
  endDate: string,
  userId: string,
  userRole: string
): Promise<void> {
  try {
    const { error } = await supabase.rpc('log_finance_operation', {
      p_school_code: schoolCode,
      p_event_type: 'export',
      p_resource_type: 'report',
      p_resource_id: undefined,
      p_user_id: userId,
      p_user_role: userRole,
      p_action_details: {
        export_type: exportType,
        start_date: startDate,
        end_date: endDate,
      },
      p_ip_address: undefined,
      p_user_agent: undefined,
    });

    if (error) {
      log.error('Failed to log export operation:', error);
    }
  } catch (error) {
    log.error('Audit logging error:', error);
  }
}

// =============================================================================
// CSV Export
// =============================================================================

/**
 * Convert transactions to CSV format
 */
function transactionsToCSV(transactions: FinanceTransaction[]): string {
  const headers = [
    'Date',
    'Type',
    'Amount',
    'Category',
    'Account',
    'Description',
    'Created At',
  ];

  const rows = transactions.map((txn) => [
    txn.txn_date,
    txn.type.toUpperCase(),
    txn.amount.toString(),
    txn.category?.name || 'Unknown',
    txn.account?.name || 'Unknown',
    txn.description || '',
    format(new Date(txn.created_at), 'yyyy-MM-dd HH:mm:ss'),
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  return csvContent;
}

/**
 * Export transactions as CSV file
 */
export async function exportTransactionsToCSV(
  schoolCode: string,
  startDate: string,
  endDate: string,
  userId: string,
  userRole: string,
  filters?: {
    type?: 'income' | 'expense';
    category_id?: string;
    account_id?: string;
  }
): Promise<void> {
  try {
    // Fetch all transactions (no pagination for export)
    const { data: transactions } = await financeService.listTransactions({
      school_code: schoolCode,
      start_date: startDate,
      end_date: endDate,
      type: filters?.type,
      category_id: filters?.category_id,
      account_id: filters?.account_id,
      limit: 10000, // Large limit for export
    });

    if (!transactions || transactions.length === 0) {
      Alert.alert('No Data', 'No transactions found for the selected period.');
      return;
    }

    // Generate CSV content
    const csvContent = transactionsToCSV(transactions);

    // Create filename
    const dateStr = format(new Date(), 'yyyy-MM-dd');
    const filename = `Finance_Transactions_${startDate}_to_${endDate}_${dateStr}.csv`;

    // Save to file system
    const fileUri = `${documentDirectory}${filename}`;
    await writeAsStringAsync(fileUri, csvContent, {
      encoding: EncodingType.UTF8,
    });

    // Share the file
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Export Finance Transactions',
      });
    } else {
      Alert.alert('Export Ready', `CSV file saved: ${filename}`);
    }

    // Log audit trail
    await logExportOperation(schoolCode, 'csv', startDate, endDate, userId, userRole);
  } catch (error) {
    log.error('CSV export error:', error);
    Alert.alert('Export Failed', 'Unable to export transactions. Please try again.');
    throw error;
  }
}

// =============================================================================
// PDF Report Generation
// =============================================================================

/**
 * Generate HTML content for finance report PDF
 */
function generateFinanceReportHTML(
  summary: {
    total_income: number;
    total_expense: number;
    net_income: number;
    period_start: string;
    period_end: string;
  },
  monthlySummary: Array<{
    month: string;
    total_income: number;
    total_expense: number;
    net_income: number;
    transaction_count: number;
  }>,
  schoolName?: string
): string {
  const periodStart = format(new Date(summary.period_start), 'MMM dd, yyyy');
  const periodEnd = format(new Date(summary.period_end), 'MMM dd, yyyy');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 40px;
      color: #333;
      background: #fff;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
      border-bottom: 3px solid #6366f1;
      padding-bottom: 20px;
    }
    .header h1 {
      font-size: 28px;
      color: #1e293b;
      margin-bottom: 8px;
    }
    .header .subtitle {
      color: #64748b;
      font-size: 14px;
    }
    .period {
      text-align: center;
      margin-bottom: 30px;
      color: #64748b;
      font-size: 14px;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-bottom: 40px;
    }
    .summary-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
    }
    .summary-card.income {
      border-left: 4px solid #10b981;
    }
    .summary-card.expense {
      border-left: 4px solid #ef4444;
    }
    .summary-card.net {
      border-left: 4px solid #6366f1;
    }
    .summary-card .label {
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
      margin-bottom: 8px;
      font-weight: 600;
    }
    .summary-card .amount {
      font-size: 24px;
      font-weight: bold;
      color: #1e293b;
    }
    .summary-card.income .amount {
      color: #10b981;
    }
    .summary-card.expense .amount {
      color: #ef4444;
    }
    .summary-card.net .amount {
      color: #6366f1;
    }
    .monthly-section {
      margin-top: 40px;
    }
    .monthly-section h2 {
      font-size: 20px;
      color: #1e293b;
      margin-bottom: 20px;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }
    th {
      background: #f1f5f9;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      color: #475569;
      font-size: 12px;
      text-transform: uppercase;
      border-bottom: 2px solid #e2e8f0;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #e2e8f0;
      color: #334155;
    }
    tr:hover {
      background: #f8fafc;
    }
    .text-right {
      text-align: right;
    }
    .text-center {
      text-align: center;
    }
    .positive {
      color: #10b981;
      font-weight: 600;
    }
    .negative {
      color: #ef4444;
      font-weight: 600;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      color: #94a3b8;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Finance Report</h1>
    ${schoolName ? `<div class="subtitle">${schoolName}</div>` : ''}
  </div>
  
  <div class="period">
    Period: ${periodStart} to ${periodEnd}
  </div>
  
  <div class="summary">
    <div class="summary-card income">
      <div class="label">Total Income</div>
      <div class="amount">₹${summary.total_income.toLocaleString('en-IN')}</div>
    </div>
    <div class="summary-card expense">
      <div class="label">Total Expense</div>
      <div class="amount">₹${summary.total_expense.toLocaleString('en-IN')}</div>
    </div>
    <div class="summary-card net">
      <div class="label">Net Income</div>
      <div class="amount ${summary.net_income >= 0 ? 'positive' : 'negative'}">
        ₹${Math.abs(summary.net_income).toLocaleString('en-IN')}
      </div>
    </div>
  </div>
  
  ${monthlySummary.length > 0 ? `
  <div class="monthly-section">
    <h2>Monthly Breakdown</h2>
    <table>
      <thead>
        <tr>
          <th>Month</th>
          <th class="text-right">Income</th>
          <th class="text-right">Expense</th>
          <th class="text-right">Net</th>
          <th class="text-center">Transactions</th>
        </tr>
      </thead>
      <tbody>
        ${monthlySummary.map((month) => `
          <tr>
            <td>${format(new Date(month.month + '-01'), 'MMMM yyyy')}</td>
            <td class="text-right positive">₹${month.total_income.toLocaleString('en-IN')}</td>
            <td class="text-right negative">₹${month.total_expense.toLocaleString('en-IN')}</td>
            <td class="text-right ${month.net_income >= 0 ? 'positive' : 'negative'}">
              ₹${Math.abs(month.net_income).toLocaleString('en-IN')}
            </td>
            <td class="text-center">${month.transaction_count}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}
  
  <div class="footer">
    Generated on ${format(new Date(), 'MMMM dd, yyyy hh:mm a')}
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate and export finance report as PDF
 */
export async function generateFinanceReportPDF(
  schoolCode: string,
  startDate: string,
  endDate: string,
  userId: string,
  userRole: string,
  schoolName?: string
): Promise<void> {
  try {
    // Fetch summary data
    const summary = await financeReportsService.getIncomeVsExpense(
      schoolCode,
      startDate,
      endDate
    );

    const monthlySummary = await financeReportsService.getMonthlySummary(
      schoolCode,
      startDate,
      endDate
    );

    // Generate HTML
    const htmlContent = generateFinanceReportHTML(summary, monthlySummary, schoolName);

    // Generate PDF
    const { uri } = await Print.printToFileAsync({
      html: htmlContent,
      base64: false,
    });

    const dateStr = format(new Date(), 'yyyy-MM-dd');
    const filename = `Finance_Report_${startDate}_to_${endDate}_${dateStr}.pdf`;
    const newUri = `${documentDirectory}${filename}`;

    // Move file to document directory
    await moveAsync({
      from: uri,
      to: newUri,
    });

    // Share the file
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(newUri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Save Finance Report PDF',
      });
    } else {
      Alert.alert('PDF Ready', `Report saved: ${filename}`);
    }

    // Log audit trail
    await logExportOperation(schoolCode, 'pdf', startDate, endDate, userId, userRole);
  } catch (error) {
    log.error('PDF generation error:', error);
    Alert.alert('PDF Generation Failed', 'Unable to generate report. Please try again.');
    throw error;
  }
}

