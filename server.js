require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

// Cache token in memory — valid for 24hrs, re-fetch if expired
let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
    if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

    const res = await axios.post(
        `${process.env.BASE_URL}/authenticate`,
        {},
        {
            headers: {
                'x-api-key':     process.env.API_KEY,
                'x-api-secret':  process.env.API_SECRET,
                'x-api-version': '1.0.0',
                'Content-Type':  'application/json',
            },
        }
    );

    cachedToken = res.data.data.access_token;
    tokenExpiresAt = Date.now() + 23 * 60 * 60 * 1000; // 23hrs (1hr buffer)
    return cachedToken;
}

function parseAddress(pradr) {
    if (!pradr || !pradr.addr) return {};
    const a = pradr.addr;
    return {
        addressLine1: [a.bno, a.bnm].filter(Boolean).join(', '),
        addressLine2: [a.flno, a.st].filter(Boolean).join(', '),
        city:         a.loc  || a.dst || '',
        state:        a.stcd || '',
        pincode:      a.pncd || '',
    };
}

// POST /api/gst-lookup
// Body: { "gstin": "24ABKCS2033B1ZV" }
app.post('/api/gst-lookup', async (req, res) => {
    const gstin = (req.body.gstin || '').toUpperCase().trim();

    if (!gstin) {
        return res.status(400).json({ error: 'gstin is required' });
    }

    if (gstin.length !== 15 || !GST_REGEX.test(gstin)) {
        return res.status(400).json({ error: 'Invalid GSTIN format' });
    }

    try {
        const token = await getAccessToken();

        const response = await axios.post(
            `${process.env.BASE_URL}/gst/compliance/public/gstin/search`,
            { gstin },
            {
                headers: {
                    'x-api-key':     process.env.API_KEY,
                    'authorization': token,
                    'x-api-version': '1.0',
                    'Content-Type':  'application/json',
                },
            }
        );

        const d = response.data?.data?.data;
        if (!d) {
            return res.status(404).json({ error: 'GSTIN not found' });
        }

        const address = parseAddress(d.pradr);

        return res.json({
            gstin:            d.gstin,
            companyName:      d.lgnm,
            tradeName:        d.tradeNam || d.lgnm,
            status:           d.sts,
            constitution:     d.ctb,
            businessType:     d.dty,
            registrationDate: d.rgdt,
            ...address,
        });

    } catch (err) {
        const status = err.response?.status || 500;
        const message = err.response?.data?.message || err.message;
        return res.status(status).json({ error: message });
    }
});

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));