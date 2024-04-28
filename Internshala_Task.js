require("dotenv").config();
const Airtable = require('airtable');

const apiKey = process.env.YOUR_API_KEY;
const baseId = process.env.YOUR_BASE_ID;
const tableName = process.env.YOUR_TABLE_NAME;

const base = new Airtable({ apiKey }).base(baseId);

function fetchDataAndDisplay() {
  base(tableName).select({
    maxRecords: 10,
    view: "Grid view"
  }).eachPage((records, fetchNextPage) => {

    records.forEach((record) => {
      // Extract the fields you're interested in
      const firstName = record.get('FirstName');
      const lastName = record.get('LastName');
      const status = record.get('Status');

      console.log(`${firstName}\t${lastName}\t${status}`);
    });

    fetchNextPage();
  }, (err) => {
    if (err) {
      console.error('Error fetching data:', err);
      return;
    }
    console.log('Done fetching data.');
  });
}

fetchDataAndDisplay();
