const { importCsv } = require('./services/csvImporter');

async function run() {
  try {
    const log = await importCsv('uploads/file-1781463262962-498283642.csv', 1, 1);
    console.log('Import successful', log.toJSON());
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
