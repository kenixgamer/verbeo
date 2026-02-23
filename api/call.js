const ipCache = new Map();

// Clear cache every hour to prevent memory leaks in warm instances
setInterval(() => ipCache.clear(), 3600000);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Basic IP-based Rate Limiting (in-memory per function instance)
    const forwarded = req.headers['x-forwarded-for'];
    const ip = typeof forwarded === 'string' ? forwarded.split(',')[0] : req.socket?.remoteAddress || 'unknown';

    if (ip !== 'unknown') {
        const now = Date.now();
        const records = ipCache.get(ip) || [];
        // Keep requests from the last 15 minutes
        const recentRecords = records.filter(timestamp => now - timestamp < 15 * 60 * 1000);
        
        // Limit to 2 demo calls per IP per 15 minutes
        if (recentRecords.length >= 2) {
            return res.status(429).json({ error: 'Too many requests. Please try again later.' });
        }
        
        recentRecords.push(now);
        ipCache.set(ip, recentRecords);
    }

    const { toNumber, firstName, email } = req.body;

    if (!toNumber) {
        return res.status(400).json({ error: 'Phone number is required' });
    }
    
    // Retrieve environment variables
    const agentId = process.env.VERBEO_AGENT_ID || "32a33c6c-40e1-4147-bb78-2afc86d47e9c";
    const fromNumber = process.env.VERBEO_FROM_NUMBER || "+15418027889";
    const apiKey = process.env.VERBEO_API_KEY || "vbr_be86bf943bc89e4463d32f63bf1a5c99af4be6c525a4ce1ef9033f39fc02e71a";

    try {
        const response = await fetch("https://api.verbeo.ai/calls", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "toNumber": toNumber,
                "agentId": agentId,
                "fromNumber": fromNumber,
                "dynamicVariables": {
                    "first_name": firstName || "",
                    "emai": email || "" // Note: spelled "emai" based on existing implementation
                }
            })
        });

        if (response.ok) {
            const data = await response.json();
            return res.status(200).json(data);
        } else {
            const errorData = await response.text();
            console.error("Verbeo API Error:", errorData);
            return res.status(response.status).json({ error: errorData });
        }
    } catch (error) {
        console.error("Internal Server Error:", error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
