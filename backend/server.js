const express = require('express');
const cors = require('cors');
const fs = require('fs');

const app = express();

app.use(express.json());
app.use(cors());

let latestData = {};
let control = { led1: 0, led2: 0 };

// ===============================
// 🧠 DIGITAL TWIN LOGIC
// ===============================
function digitalTwin(data) {
    let isDark = data.ldr < 2000;

    let led1 = (isDark && data.ir1 == 0) ? 1 : 0;
    let led2 = (isDark && data.ir2 == 0) ? 1 : 0;

    return { led1, led2 };
}

// ===============================
// 📥 RECEIVE DATA FROM ESP32
// ===============================
app.post('/data', (req, res) => {
    latestData = req.body;

    console.log("📊 Received Data:", latestData);

    // 🧠 Run Digital Twin
    control = digitalTwin(latestData);

    console.log("🤖 Twin Output:", control);

    // ===============================
    // 🗄️ SAVE TO CSV
    // ===============================
    const filePath = 'data.csv';

    // Add header if file doesn't exist
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, "timestamp,temp,hum,ldr,ir1,ir2\n");
    }

    const line = `${Date.now()},${latestData.temp},${latestData.hum},${latestData.ldr},${latestData.ir1},${latestData.ir2}\n`;

    fs.appendFile(filePath, line, (err) => {
        if (err) console.error("❌ CSV Error:", err);
    });

    res.send("OK");
});

// ===============================
// 📤 SEND DATA TO DASHBOARD
// ===============================
app.get('/data', (req, res) => {
    res.json(latestData);
});

// ===============================
// 🔁 SEND CONTROL TO ESP32
// ===============================
app.get('/control', (req, res) => {
    res.json(control);
});

// ===============================
// 📜 SERVE HISTORICAL CSV DATA
// ===============================
app.get('/history', (req, res) => {
    const filePath = 'data.csv';
    const limit = parseInt(req.query.limit) || 200;

    if (!fs.existsSync(filePath)) {
        return res.json([]);
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.trim().split('\n');
    const headers = lines[0].split(','); // timestamp,temp,hum,ldr,ir1,ir2

    const rows = lines.slice(1)
        .filter(l => l.trim())
        .map(l => {
            const vals = l.split(',');
            const obj = {};
            headers.forEach((h, i) => {
                obj[h.trim()] = isNaN(vals[i]) ? vals[i] : parseFloat(vals[i]);
            });
            return obj;
        });

    // Return last `limit` rows
    res.json(rows.slice(-limit));
});

// ===============================
// 🌐 SERVE FRONTEND STATIC FILES
// ===============================
const path = require('path');
app.use(express.static(path.join(__dirname, '..', 'frontend')));

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log("🚀 Server running on port " + PORT);
});