require('dotenv').config();
const axios = require('axios');

const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

function validate(gstin) {
    if (gstin.length !== 15) return { valid: false, reason: 'Must be exactly 15 characters' };
    if (!GST_REGEX.test(gstin)) return { valid: false, reason: 'Invalid format (expected: 22AAAAA0000A1Z5)' };
    return { valid: true };
}

function parseAddress(pradr) {
    if (!pradr || !pradr.addr) return 'N/A';
    const a = pradr.addr;
    return [a.flno, a.bno, a.bnm, a.st, a.loc, a.dst, a.stcd, a.pncd]
        .filter(Boolean)
        .join(', ');
}

function parseResponse(d) {
    return {
        gstin:               d.gstin     ?? 'N/A',
        legalName:           d.lgnm      ?? 'N/A',
        tradeName:           d.tradeNam  || d.lgnm || 'N/A',
        status:              d.sts       ?? 'N/A',
        businessType:        d.dty       ?? 'N/A',
        constitution:        d.ctb       ?? 'N/A',
        registrationDate:    d.rgdt      ?? 'N/A',
        lastUpdated:         d.lstupdt   ?? 'N/A',
        address:             parseAddress(d.pradr),
        stateJurisdiction:   d.stj       ?? 'N/A',
        centralJurisdiction: d.ctj       ?? 'N/A',
        einvoiceEnabled:     d.einvoiceStatus ?? 'N/A',
    };
}

async function getAccessToken() {
    const res = await axios.post(
        `${process.env.BASE_URL}/authenticate`,
        {},
        {
            timeout: 10000,
            headers: {
                'x-api-key':     process.env.API_KEY,
                'x-api-secret':  process.env.API_SECRET,
                'x-api-version': '1.0.0',
                'Content-Type':  'application/json',
            },
        }
    );
    return res.data.data.access_token;
}

async function fetchGSTDetails(gstin, token) {
    const res = await axios.post(
        `${process.env.BASE_URL}/gst/compliance/public/gstin/search`,
        { gstin },
        {
            timeout: 10000,
            headers: {
                'x-api-key':     process.env.API_KEY,
                'authorization': token,           // no "Bearer" prefix
                'x-api-version': '1.0',
                'Content-Type':  'application/json',
            },
        }
    );
    return res.data;
}

async function main() {
    const gstin = (process.argv[2] || '').toUpperCase().trim();

    if (!gstin) {
        console.error('Usage:   node index.js <GSTIN>');
        console.error('Example: node index.js 24ABKCS2033B1ZV');
        process.exit(1);
    }

    const check = validate(gstin);
    if (!check.valid) {
        console.error(`Invalid GSTIN — ${check.reason}`);
        process.exit(1);
    }

    console.log(`Looking up GSTIN: ${gstin}\n`);

    try {
        process.stdout.write('Step 1/2: Authenticating ... ');
        const token = await getAccessToken();
        console.log('OK');

        process.stdout.write('Step 2/2: Fetching company details ... ');
        const raw = await fetchGSTDetails(gstin, token);
        console.log('OK\n');

        console.log('=== RAW API RESPONSE ===');
        console.log(JSON.stringify(raw, null, 2));

        const payload = raw?.data?.data;
        if (!payload) {
            console.error('\nNo data returned. GSTIN may not exist.');
            process.exit(1);
        }

        const parsed = parseResponse(payload);

        console.log('\n=== PARSED COMPANY DETAILS ===');
        Object.entries(parsed).forEach(([key, val]) => {
            console.log(`  ${key.padEnd(22)}: ${val}`);
        });

    } catch (err) {
        if (err.response) {
            console.error(`\nHTTP ${err.response.status}:`, JSON.stringify(err.response.data, null, 2));
        } else {
            console.error('\nRequest failed:', err.message);
        }
        process.exit(1);
    }
}

main();