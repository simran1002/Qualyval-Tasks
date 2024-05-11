const puppeteer = require('puppeteer');

async function scrapeData(url) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle0' });

    const results = await page.evaluate(() => {
        const listings = [];
        document.querySelectorAll("div.agentCard_cardContent__Iepiw").forEach(property => {
            // Extract details from each property card
            const address = property.querySelector("a.ksc_link.default")?.innerText.trim() ?? 'Address Unavailable';
            const description = property.querySelector("p.agentCard_cardDescription__LeHIZ")?.innerText.trim() ?? 'Type Unavailable';
            const lettingsContactNumber = property.querySelector("span.agentTelephoneNumbers_number__kO7Oi")?.innerText.trim() ?? 'Type Unavailable';
            // const sale = property.querySelector("span.agentTelephoneNumbers_number__kO7Oi")?.innerText.trim() ?? 'Type Unavailable';
           
            
            

            // Sale history, assuming it's contained within a table or similar structure
            const sales = Array.from(property.querySelectorAll("h2._2csOLVQ8LhWp0He2y-z84U")).map(record => ({
                dateSold: record.querySelector(".transaction-table-container")?.innerText ?? 'Date Unavailable',
                percentChange: record.querySelector(".percentChange")?.innerText ?? 'Change Unavailable',
                soldPrice: record.querySelector("h2._2csOLVQ8LhWp0He2y-z84U")?.innerText ?? 'Price Unavailable',
                tenure: record.querySelector(".tenure")?.innerText ?? 'Tenure Unavailable'
            }));

            const agentName = property.querySelector(".property")?.innerText.trim() ?? 'Agent Name Unavailable';
            const agentPhone = property.querySelector(".propertyCard-agentPhone")?.innerText ?? 'Agent Phone Unavailable';

            listings.push({
                agentName,
                agentPhone,
                address,
                description,
                lettingsContactNumber,
                // typeOfProperty,
                // Price,
                sales
            });
        });

        return listings;
    });

    await browser.close();
    return results;
}

function aggregateByAgent(listings) {
    const agentData = {};

    listings.forEach(listing => {
        const { agentName, agentPhone, address,description,lettingsContactNumber, sales } = listing;
        if (!agentData[agentName]) {
            agentData[agentName] = {
                agentPhone,
                properties: []
            };
        }
        agentData[agentName].properties.push({
            address,
            description,
            lettingsContactNumber,
            sales
        });
    });

    return agentData;
}

async function main() {
    try {
        const url = "https://www.rightmove.co.uk/estate-agents/find.html?radius=0.0&locationIdentifier=REGION^940&brandName=&branchType=ALL";
        const scrapedData = await scrapeData(url);
        const aggregatedData = aggregateByAgent(scrapedData);

        // Output the aggregated data
        console.log(JSON.stringify(aggregatedData, null, 2));
    } catch (error) {
        console.error('An error occurred:', error);
    }
}

main();
