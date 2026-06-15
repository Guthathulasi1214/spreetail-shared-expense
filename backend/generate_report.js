const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function generateReport() {
  const connection = await mysql.createConnection({
    uri: 'mysql://root:eaqXZyLHSHiNAUvrPqxOJSrhogJcbdHz@thomas.proxy.rlwy.net:41069/railway',
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Get the most recent import log
    const [logs] = await connection.query('SELECT * FROM import_logs ORDER BY id DESC LIMIT 1');
    if (logs.length === 0) {
      console.log("No import logs found in the database. Did you upload the CSV on the live site yet?");
      process.exit(1);
    }

    const latestLog = logs[0];
    
    // Get all anomalies for this import
    const [anomalies] = await connection.query('SELECT * FROM import_anomalies WHERE import_log_id = ? ORDER BY id ASC', [latestLog.id]);

    let report = `========================================================\n`;
    report += `              SPREETAIL IMPORT REPORT\n`;
    report += `========================================================\n\n`;
    report += `Date of Import: ${new Date(latestLog.imported_at).toLocaleString()}\n`;
    report += `Original File: expenses_export.csv\n\n`;
    report += `--- SUMMARY ---\n`;
    report += `Total Rows Processed : ${latestLog.total_rows}\n`;
    report += `Successfully Imported: ${latestLog.rows_imported}\n`;
    report += `Skipped (Duplicates) : ${latestLog.rows_skipped}\n`;
    report += `Flagged (Anomalies)  : ${latestLog.rows_flagged}\n\n`;
    report += `========================================================\n`;
    report += `                 ANOMALIES DETECTED\n`;
    report += `========================================================\n\n`;

    if (anomalies.length === 0) {
      report += `No anomalies detected during this import.\n`;
    } else {
      anomalies.forEach((anomaly, index) => {
        report += `Anomaly #${index + 1}\n`;
        report += `Row Number : ${anomaly.row_number}\n`;
        report += `Issue Type : ${anomaly.anomaly_type.toUpperCase()}\n`;
        report += `Description: ${anomaly.description}\n`;
        report += `Action     : ${anomaly.action_taken}\n`;
        report += `Status     : ${anomaly.approved === null ? 'Pending Manual Review' : anomaly.approved ? 'Approved' : 'Rejected'}\n`;
        
        let rowData;
        try {
            rowData = JSON.parse(anomaly.raw_row_data);
            report += `Raw Data   :\n`;
            for (const [key, value] of Object.entries(rowData)) {
                report += `  - ${key}: ${value}\n`;
            }
        } catch(e) {
             report += `Raw Data   : ${anomaly.raw_row_data}\n`;
        }
        report += `--------------------------------------------------------\n\n`;
      });
    }

    const outputPath = path.join(__dirname, '..', 'Import_Report.txt');
    fs.writeFileSync(outputPath, report, 'utf8');
    console.log(`Report successfully generated at: ${outputPath}`);

  } catch (error) {
    console.error("Error generating report:", error);
  } finally {
    await connection.end();
  }
}

generateReport();
