require('dotenv').config();
const { google } = require('googleapis');
const Airtable = require('airtable');

// Google Sheets setup with JWT-based authentication
const googleSheets = google.sheets({
    version: 'v4',
    auth: new google.auth.JWT(
        process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        null,
        process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), // Ensure private key is correctly formatted
        ['https://www.googleapis.com/auth/spreadsheets']
    )
});

// Airtable setup using API key and base configuration
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
const table = base(process.env.AIRTABLE_TABLE_NAME);

// Function to get data from Google Sheets
const getGoogleSheetsData = async () => {
    try {
        const response = await googleSheets.spreadsheets.values.get({
            spreadsheetId: process.env.GOOGLE_SHEET_ID,
            range: 'Sheet1'
        });
        // Return an empty array if no data found
        return response.data.values || [];
    } catch (error) {
        console.error('Error retrieving data from Google Sheets:', error);
        return []; // Return empty array on error
    }
};

// Function to fetch data from Airtable
const getAirtableData = async () => {
    try {
        const records = await table.select().firstPage();
        return records.map(record => ({
            id: record.id,
            fields: record.fields
        }));
    } catch (error) {
        console.error('Error retrieving data from Airtable:', error);
        return []; // Return empty array on error
    }
};

// Function to update Google Sheets with data from Airtable
const updateGoogleSheet = async (data, headers) => {
    try {
        const values = [headers.map(h => h.name)]; // First row as headers
        values.push(...data.map(r => headers.map(h => r.fields[h.name] || ''))); // Map each row to the headers

        await googleSheets.spreadsheets.values.update({
            spreadsheetId: process.env.GOOGLE_SHEET_ID,
            range: 'Sheet1',
            valueInputOption: 'RAW',
            resource: { values }
        });
    } catch (error) {
        console.error('Error updating Google Sheets:', error);
    }
};


// Function to update Airtable with data from Google Sheets
const updateAirtable = async (data) => {
    try {
        for (let record of data) {
            await table.update([{ id: record.id, fields: record.fields }]);
        }
    } catch (error) {
        console.error('Error updating Airtable:', error);
    }
};

// Sync Google Sheets data to Airtable
const syncSheetsToAirtable = async () => {
    try {
        const sheetData = await getGoogleSheetsData();
        if (sheetData.length === 0) {
            console.log('No data found in Google Sheets to sync.');
            return;
        }
        sheetData.shift(); // Remove header row, assuming first row is headers like FirstName, LastName, Status

        const airtableData = await getAirtableData();
        // Assuming 'Name' is a concatenation of 'FirstName' and 'LastName' for unique identification in Airtable
        const airtableMap = new Map(airtableData.map(item => [(item.fields['FirstName'] + ' ' + item.fields['LastName']), item]));

        for (const row of sheetData) {
            if (row.length < 3) continue; // Skip rows that don't have enough data (assuming three fields: FirstName, LastName, Status)
            const [firstName, lastName, status] = row;
            const fullName = firstName + ' ' + lastName;
            const record = airtableMap.get(fullName);
            if (record) {
                // Update existing record if any field has changed
                const fieldsToUpdate = {};
                if (record.fields['FirstName'] !== firstName) fieldsToUpdate['FirstName'] = firstName;
                if (record.fields['LastName'] !== lastName) fieldsToUpdate['LastName'] = lastName;
                if (record.fields['Status'] !== status) fieldsToUpdate['Status'] = status;

                if (Object.keys(fieldsToUpdate).length > 0) {
                    await table.update([{ id: record.id, fields: fieldsToUpdate }]);
                }
            } else {
                // Create new record if not found
                await table.create({ 'FirstName': firstName, 'LastName': lastName, 'Status': status }, { typecast: true });
            }
        }
        console.log('Data synced from Google Sheets to Airtable');
    } catch (error) {
        console.error('Failed to sync from Sheets to Airtable:', error);
    }
};



// Sync Airtable data to Google Sheets
const syncAirtableToSheets = async () => {
    try {
        const records = await getAirtableData();
        if (records.length === 0) {
            console.log('No data found in Airtable to sync.');
            return;
        }

        // Define headers based on your Airtable design
        // Example headers: assume your Airtable fields are named 'FirstName', 'LastName', 'Status'
        const headers = [
            { name: 'FirstName', label: 'First Name' },
            { name: 'LastName', label: 'Last Name' },
            { name: 'Status', label: 'Status' }
        ];

        await updateGoogleSheet(records, headers);
        console.log('Data synced from Airtable to Google Sheets');
    } catch (error) {
        console.error('Failed to sync from Airtable to Sheets:', error);
    }
};


// Execute both synchronization functions
const syncAll = async () => {
    await syncSheetsToAirtable();
    await syncAirtableToSheets();
};

syncAll().catch(console.error);
