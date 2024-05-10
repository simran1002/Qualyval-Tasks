const puppeteer = require('puppeteer');

async function scrapeData(url) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle0' });

    const results = await page.evaluate(() => {
        const listings = [];
        document.querySelectorAll(".propertyCard").forEach(property => {
            // Extract details from each property card
            const propertyHistory = property.querySelector(".propertyCard-content")?.innerText ?? 'History Unavailable';
            const soldPrice = property.querySelector(".sold-price")?.innerText ?? 'Sold Price Unavailable';
            const tenure = property.querySelector(".tenure")?.innerText ?? 'Tenure Unavailable';

            const agentName = property.querySelector(".propertyCard-branchName")?.innerText.trim() ?? 'Agent Name Unavailable';
            const agentPhone = property.querySelector(".propertyCard-phoneNumber")?.innerText ?? 'Agent Phone Unavailable';
            const propertyName = property.querySelector(".property-information")?.innerText ?? 'Property Name Unavailable';

            listings.push({
                agentName,
                agentPhone,
                propertyName,
                propertyDetails: {
                    propertyHistory,
                    soldPrice,
                    tenure
                }
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
        const { agentName, agentPhone, propertyName, propertyDetails } = listing;
        if (!agentData[agentName]) {
            agentData[agentName] = {
                agentPhone,
                properties: []
            };
        }
        agentData[agentName].properties.push({
            propertyName,
            propertyDetails
        });
    });

    return agentData;
}

async function main() {
    try {
        const url = "https://www.rightmove.co.uk/house-prices/milton-keynes.html?page=1";
        const scrapedData = await scrapeData(url);
        const aggregatedData = aggregateByAgent(scrapedData);

        // Output the aggregated data
        console.log(JSON.stringify(aggregatedData, null, 2));
    } catch (error) {
        console.error('An error occurred:', error);
    }
}

main();
