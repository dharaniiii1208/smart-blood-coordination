
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
console.log('Server file location:', __dirname);
console.log('Website folder:', path.join(__dirname, 'public'));
console.log('index.html exists:', fs.existsSync(path.join(__dirname, 'public', 'index.html')));
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'blood_coordination',
  ssl: process.env.DB_HOST
    ? { rejectUnauthorized: true }
    : undefined,
  waitForConnections: true,
  connectionLimit: 10
});

// Test whether the Node.js server is running
app.get('/api/health', (req, res) => {
    res.json({
        message: 'Smart Blood Coordination API is running!'
    });
});

// Test the MySQL database connection
app.get('/api/db-test', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT COUNT(*) AS total FROM blood_requests'
        );

        res.json({
            message: 'MySQL connected successfully!',
            totalRequests: rows[0].total
        });
    } catch (error) {
        console.error('Database error:', error.message);
        res.status(500).json({
            message: 'Database connection failed. Check your configuration.'
        });
    }
});


app.get('/api/hospitals', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT hospital_id, hospital_name, address, contact_number FROM hospitals'
        );
        res.json(rows);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: 'Could not load hospitals.' });
    }
});

app.get('/api/requests', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                br.request_id,
                br.patient_name,
                br.blood_group,
                br.units_required,
                br.request_status,
                br.request_date,
                h.hospital_name
            FROM blood_requests br
            LEFT JOIN hospitals h
                ON br.hospital_id = h.hospital_id
            ORDER BY br.request_date DESC
        `);
        res.json(rows);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: 'Could not load blood requests.' });
    }
});

app.post('/api/requests', async (req, res) => {
    const {
        patient_name,
        blood_group,
        units_required,
        hospital_id
    } = req.body;

    const validGroups = [
        'A+', 'A-', 'B+', 'B-',
        'AB+', 'AB-', 'O+', 'O-'
    ];

    const units = Number(units_required);
    const hospitalId = Number(hospital_id);

    if (!patient_name || !patient_name.trim()) {
        return res.status(400).json({
            message: 'Patient name is required.'
        });
    }

    if (!validGroups.includes(blood_group)) {
        return res.status(400).json({
            message: 'Please select a valid blood group.'
        });
    }

    if (!Number.isInteger(units) || units < 1 || units > 20) {
        return res.status(400).json({
            message: 'Units must be a whole number between 1 and 20.'
        });
    }

    if (!Number.isInteger(hospitalId) || hospitalId < 1) {
        return res.status(400).json({
            message: 'Please select a valid hospital.'
        });
    }

    try {
        const [hospitals] = await db.execute(
            'SELECT hospital_id FROM hospitals WHERE hospital_id = ?',
            [hospitalId]
        );

        if (hospitals.length === 0) {
            return res.status(400).json({
                message: 'The selected hospital does not exist.'
            });
        }

        const [result] = await db.execute(
            `INSERT INTO blood_requests
             (patient_name, blood_group, units_required, hospital_id, request_status)
             VALUES (?, ?, ?, ?, 'PENDING')`,
            [patient_name.trim(), blood_group, units, hospitalId]
        );

        res.status(201).json({
            message: 'Blood request created successfully!',
            requestId: result.insertId
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            message: 'Could not create blood request.'
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

