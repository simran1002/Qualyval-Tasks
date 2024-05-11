const puppeteer = require('puppeteer');
const { MongoClient } = require('mongodb');

// MongoDB URI and client setup
const uri = "mongodb+srv://project:V7NtcBcmOtoyHwXG@cluster0.iuuyewt.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function scrapeData(url) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
        await page.goto(url, { waitUntil: 'networkidle0' });
        const results = await page.evaluate(() => {
            const listings = [];
            document.querySelectorAll(".propertyCard-wrapper").forEach(property => {
                const propertyInfo = property.querySelector(".property-information")?.innerText.trim() ?? 'Property Type Unavailable';

                // Initialize default values
                let propertyType = 'Type Unavailable', bedrooms = 'Bedrooms Unavailable', bathrooms = 'Bathrooms Unavailable';

                // Handling multiline property information
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
                const agentName = property.querySelector(".propertyCard-branchSummary-branchName")?.innerText.trim() ?? 'Agent Name Unavailable';
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

        return results;
    } catch (error) {
        console.error("Error scraping data:", error);
        return []; // Return an empty array to avoid further errors
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

        const url = "https://www.rightmove.co.uk/property-to-rent/find.html?locationIdentifier=REGION%5E87490&radius=40.0&propertyTypes=&includeLetAgreed=false&mustHave=&dontShow=&furnishTypes=&keywords=";
        const data = await scrapeData(url);

        if (data.length > 0) {
            const insertResult = await collection.insertMany(data);
            console.log('Inserted documents:', insertResult.insertedCount);
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