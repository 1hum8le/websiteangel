const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = 'database.json';

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public')); // Serwuje pliki statyczne (html, css)

// Inicjalizacja bazy danych jeśli nie istnieje
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ appointments: [], blocked: [] }));
}

// Funkcje pomocnicze
const readDB = () => JSON.parse(fs.readFileSync(DB_FILE));
const writeDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

// API: Pobierz wszystkie zajęte terminy (dla kalendarza)
app.get('/api/slots', (req, res) => {
    const db = readDB();
    // Zwracamy tylko daty i godziny, bez danych osobowych klientów (RODO/GDPR)
    const busySlots = db.appointments
        .filter(a => a.status === 'approved' || a.status === 'pending')
        .map(a => ({ date: a.date, time: a.time }));
    
    res.json({ busy: busySlots, blocked: db.blocked });
});

// API: Dodaj nową rezerwację
app.post('/api/book', (req, res) => {
    const { name, phone, service, date, time } = req.body;
    const db = readDB();

    // Sprawdź czy termin wolny
    const isTaken = db.appointments.find(a => a.date === date && a.time === time && a.status !== 'rejected');
    if (isTaken) {
        return res.status(400).json({ message: 'Ten termin jest już zajęty.' });
    }

    const newAppointment = {
        id: Date.now(),
        name, phone, service, date, time,
        status: 'pending', // Oczekuje na akceptację
        created_at: new Date().toISOString()
    };

    db.appointments.push(newAppointment);
    writeDB(db);
    res.json({ message: 'Rezerwacja wysłana! Czekaj na potwierdzenie.', appointment: newAppointment });
});

// API ADMIN: Pobierz wszystkie wizyty
app.get('/api/admin/appointments', (req, res) => {
    const db = readDB();
    res.json(db.appointments);
});

// API ADMIN: Zmień status (Zatwierdź/Odrzuć)
app.post('/api/admin/status', (req, res) => {
    const { id, status } = req.body;
    const db = readDB();
    const appIndex = db.appointments.findIndex(a => a.id === id);
    
    if (appIndex > -1) {
        db.appointments[appIndex].status = status;
        writeDB(db);
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false });
    }
});

// Start serwera
app.listen(PORT, () => {
    console.log(`Serwer działa na ${PORT}`);
});