require('dotenv').config();
const { google } = require('googleapis');
const fetch = require('cross-fetch');
const Airtable = require('airtable');

// Initialize Google Sheets API
const auth = new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    null,
    process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), // Correctly format private key
    ['https://www.googleapis.com/auth/spreadsheets']
);
const sheets = google.sheets({ version: 'v4', auth });

const spreadsheetId = process.env.GOOGLE_SHEET_ID; // Ensure this is set in your .env file

// Initialize Airtable
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
const table = base(process.env.AIRTABLE_TABLE_NAME); // Adjust the table name as per your setup

// List of cities for which to fetch weather data
const cities = [
    { name: "New York", lat: 40.7128, lon: -74.0060 },
    { name: "London", lat: 51.5074, lon: -0.1278 },
    { name: "Tokyo", lat: 35.6895, lon: 139.6917 },
    { name: "Sydney", lat: -33.8688, lon: 151.2093 },
    { name: "Paris", lat: 48.8566, lon: 2.3522 },
    { name: "Berlin", lat: 52.5200, lon: 13.4050 },
    { name: "Moscow", lat: 55.7558, lon: 37.6173 },
    { name: "Mumbai", lat: 19.0760, lon: 72.8777 },
    { name: "Cape Town", lat: -33.9249, lon: 18.4241 },
    { name: "Rio de Janeiro", lat: -22.9068, lon: -43.1729 }
];

async function fetchWeatherAndUpdateSheet() {
    try {
        const weatherData = await Promise.all(cities.map(async city => {
            const apiKey = process.env.AMDOREN_API_KEY;
            const url = `https://www.amdoren.com/api/weather.php?api_key=${apiKey}&lat=${city.lat}&lon=${city.lon}`;
            const response = await fetch(url);
            const json = await response.json();

            if (!response.ok || json.error !== 0) {
                console.error(`API Error: ${json.error_message || 'Unknown error'}`);
                return [city.name, "No data", "N/A", "N/A", "Failed to fetch"];
            }

            const { date, avg_c, avg_f, summary } = json.forecast[0];
            return [city.name, date, avg_c.toString(), avg_f.toString(), summary];
        }));

        // Update Google Sheet
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: 'Sheet1!A2:E',
            valueInputOption: 'USER_ENTERED',
            resource: { values: weatherData }
        });

        // Sync to Airtable
        await syncSheetsToAirtable();
    } catch (error) {
        console.error('Failed to fetch and update weather data:', error);
    }
}


async function syncSheetsToAirtable() {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Sheet1!A2:E'
        });

        const rows = response.data.values || [];
        console.log(`Syncing ${rows.length} rows to Airtable.`);

        // Batch records in sets of 10
        for (let i = 0; i < rows.length; i += 10) {
            const batch = rows.slice(i, i + 10).map(row => {
                const [city, date, tempC, tempF, summary] = row;
                return {
                    fields: {
                        "City": city,
                        "Date": date,
                        "Temperature (C)": tempC,
                        "Temperature (F)": tempF,
                        "Weather Summary": summary
                    }
                };
            });

            try {
                const results = await table.create(batch, { typecast: true });
                results.forEach(result => {
                    console.log(`Record created successfully for ${result.fields.City}:`, result);
                });
            } catch (err) {
                console.error('Failed to create records in batch:', err);
                // Optionally, handle specific retry logic here
            }
        }
    } catch (error) {
        console.error('Failed to retrieve or sync data to Airtable:', error);
    }
}



fetchWeatherAndUpdateSheet().catch(console.error);
