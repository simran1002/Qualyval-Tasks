const puppeteer = require('puppeteer');
const { MongoClient } = require('mongodb');
const fs = require('fs');


const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

async function scrapeData(url) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    let listings = [];
    
    try {

        await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000000 });

        for (let i = 1; i <= 2; i++) {
            await page.goto(`${url}&index=${i}`, { waitUntil: 'networkidle0', timeout: 60000000 });
            const pageListings = await page.evaluate(() => {
                const listings = [];
                document.querySelectorAll(".propertyCard-wrapper").forEach(property => {
                    const propertyInfo = property.querySelector(".property-information")?.innerText.trim() ?? 'Property Type Unavailable';
                    let propertyType = 'Type Unavailable', bedrooms = 'Bedrooms Unavailable', bathrooms = 'Bathrooms Unavailable';

                    if (propertyInfo !== 'Property Type Unavailable') {
                        const lines = propertyInfo.split('\n');
                        propertyType = lines[0];
                        if (lines.length >= 3) {
                            bedrooms = `${lines[1]} bedrooms`;
                            bathrooms = `${lines[2]} bathrooms`;
                        }
                    }

                    const address = property.querySelector("address.propertyCard-address.property-card-updates")?.innerText ?? 'Address Unavailable';
                    const description = property.querySelector(".propertyCard-description span")?.innerText ?? 'Description Unavailable';
                    const price = property.querySelector(".propertyCard-priceValue")?.innerText ?? 'Price Unavailable';
                    const secondaryPrice = property.querySelector(".propertyCard-secondaryPriceValue")?.innerText ?? 'Secondary Price Unavailable';
                    const propertyUrl = property.querySelector("a.propertyCard-link")?.href ?? 'URL Unavailable';
                    const agentLogo = property.querySelector(".propertyCard-branchLogo-image")?.src ?? 'Agent Logo Unavailable';
                    let agentName = property.querySelector("div.propertyCard-branchSummary.property-card-updates")?.innerText.trim() ?? 'Agent Name Unavailable';
                    agentName = agentName.split(' by ')[1]; // Splitting the agentName here
                    const agentPhone = property.querySelector(".propertyCard-contactsPhoneNumber")?.innerText ?? 'Agent Phone Unavailable';

                    listings.push({
                        propertyType,
                        bedrooms,
                        bathrooms,
                        address,
                        description,
                        price,
                        secondaryPrice,
                        url: propertyUrl,
                        agent: {
                            name: agentName,
                            logo: agentLogo,
                            phone: agentPhone
                        }
                    });
                });
                return listings;
            });
            listings = listings.concat(pageListings);
        }
        return listings;
    } catch (error) {
        console.error("Error scraping data:", error);
        return [];
    } finally {
        await browser.close();
    }
}

async function main() {
    try {
        await client.connect();
        console.log("Connected correctly to server");
        const database = client.db("realEstate");
        const collection = database.collection("properties");

        const url = "https://www.rightmove.co.uk/property-for-sale/find.html?locationIdentifier=REGION%5E940&propertyTypes=&includeSSTC=false&mustHave=&dontShow=&furnishTypes=&keywords=";
        const data = await scrapeData(url);

        if (data.length > 0) {
            const insertResult = await collection.insertMany(data);
            console.log('Inserted documents:', insertResult.insertedCount);
            const agents = {};
            data.forEach(listing => {
                const agentName = listing.agent.name;
                const price = parseFloat(listing.price.replace(/[^0-9.-]+/g,""));
                if (!agents[agentName]) {
                    agents[agentName] = {
                        listings: [listing],
                        totalMoney: price
                    };
                } else {
                    agents[agentName].listings.push(listing);
                    agents[agentName].totalMoney += price;
                }
            });

            for (const agentName in agents) {
                console.log(`${agentName}: Total Money - ${agents[agentName].totalMoney}`);
            }

            fs.writeFileSync('agent.json', JSON.stringify(agents, null, 2));
            console.log('Agent data written to agent.json');
        } else {
            console.log('No data to insert');
        }
    } catch (err) {
        console.error('An error occurred:', err);
    } finally {
        await client.close();
    }
}

main();
