// ==========================================
// 1. LANGUAGE HANDLING (Języki)
// ==========================================
let currentLang = 'nl'; // Domyślny język

// Uruchom przy starcie
document.addEventListener('DOMContentLoaded', () => {
    setLanguage('nl');
});

function setLanguage(lang) {
    currentLang = lang;
    
    // Podmiana tekstów prostych
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (translations[lang] && translations[lang][key]) {
            element.innerHTML = translations[lang][key];
        }
    });

    // Podmiana placeholderów (np. w formularzu)
    document.querySelectorAll('[data-i18n-ph]').forEach(element => {
        const key = element.getAttribute('data-i18n-ph');
        if (translations[lang] && translations[lang][key]) {
            element.placeholder = translations[lang][key];
        }
    });

    // Podświetlenie aktywnego przycisku języka
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.remove('active');
        // Sprawdzamy po tekście w przycisku (np. NL, FR) lub po atrybucie onclick
        if(btn.getAttribute('onclick').includes(lang)) {
            btn.classList.add('active');
        }
    });

    // Odśwież podsumowanie jeśli jesteśmy w trakcie rezerwacji
    if(bookingData.service) {
        updateSummary();
    }
}

// ==========================================
// 2. FAQ ACCORDION LOGIC (Karty Info)
// ==========================================
// Mimo że zmieniliśmy wygląd na karty, zostawiamy to dla kompatybilności 
// jeśli wrócisz do akordeonów w przyszłości.
const headers = document.querySelectorAll('.accordion-header');
headers.forEach(header => {
    header.addEventListener('click', () => {
        header.classList.toggle('active');
    });
});

// ==========================================
// 3. BOOKING SYSTEM STATE (Dane Rezerwacji)
// ==========================================
let bookingData = {
    service: '',
    date: '',
    time: '',
    name: '',
    phone: ''
};

// Ustawienie minimalnej daty na "dzisiaj"
const dateInput = document.getElementById('dateInput');
if(dateInput) {
    dateInput.min = new Date().toISOString().split('T')[0];
}

// Nawigacja między krokami (Stap 1 -> Stap 2 -> Stap 3)
function goToStep(stepNumber) {
    document.querySelectorAll('.booking-step').forEach(step => step.classList.remove('active'));
    document.getElementById(`step${stepNumber}`).classList.add('active');
}

// Krok 1: Wybór Usługi
function selectService(serviceName) {
    bookingData.service = serviceName;
    
    // Wizualne zaznaczenie
    document.querySelectorAll('.service-option').forEach(opt => opt.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
    
    // Przejdź dalej po krótkim czasie (animacja)
    setTimeout(() => goToStep(2), 300);
}

// Krok 2: Generowanie Slotów Czasowych (Z SERWERA + PRZERWY)
async function loadTimeSlots() {
    const dateInputVal = document.getElementById('dateInput').value;
    const container = document.getElementById('slotsContainer');
    const grid = document.getElementById('timeSlots');
    
    if (!dateInputVal) return;

    const dateObj = new Date(dateInputVal);
    const dayOfWeek = dateObj.getDay(); 

    // 1. Blokada Poniedziałku
    if (dayOfWeek === 1) {
        alert(translations[currentLang]['alert_monday']);
        document.getElementById('dateInput').value = "";
        container.style.display = "none";
        return;
    }

    // 2. DEFINICJA PRZERW (Stałe godziny)
    const breaks = ["12:00", "16:00"];

    bookingData.date = dateInputVal;
    grid.innerHTML = '<p style="text-align:center; color:#888;">Laden...</p>';
    container.style.display = "block";

    try {
        // 3. POBIERANIE ZAJĘTYCH TERMINÓW Z SERWERA
        const response = await fetch('/api/slots');
        const data = await response.json(); 

        // Filtrujemy zajęte wizyty dla wybranej daty
        const takenTimes = data.busy
            .filter(slot => slot.date === dateInputVal)
            .map(slot => slot.time);

        // 4. GENEROWANIE SIATKI GODZIN
        let startHour = 10; 
        let endHour = 19;
        
        // Piątki i Niedziele od 11:00
        if (dayOfWeek === 5 || dayOfWeek === 0) startHour = 11;
        // Sobota do 20:00
        if (dayOfWeek === 6) endHour = 20;

        const allSlots = [];
        for (let h = startHour; h < endHour; h++) {
            allSlots.push(`${h}:00`);
            allSlots.push(`${h}:30`);
        }

        grid.innerHTML = ""; // Czyścimy loader

        allSlots.forEach(time => {
            const btn = document.createElement('div');
            btn.className = 'time-slot';
            btn.innerText = time;

            // SPRAWDZAMY: Czy zajęte PRZEZ KLIENTA -LUB- czy to PRZERWA
            if (takenTimes.includes(time) || breaks.includes(time)) {
                btn.classList.add('disabled');
                
                if (breaks.includes(time)) {
                    btn.title = "Pauze";
                    btn.style.opacity = "0.5";
                } else {
                    btn.title = "Geboekt";
                }
            } else {
                // TUTAJ JEST NAPRAWA: Dodanie obsługi kliknięcia
                btn.onclick = () => selectTime(time, btn);
            }

            grid.appendChild(btn);
        });

    } catch (error) {
        console.error("Błąd pobierania godzin:", error);
        grid.innerHTML = '<p style="color:red;">Fout bij laden tijden.</p>';
    }
}

// Funkcja obsługi kliknięcia w godzinę (TEGO BRAKOWAŁO!)
function selectTime(time, element) {
    bookingData.time = time;
    
    // Usuń zaznaczenie z innych
    document.querySelectorAll('.time-slot').forEach(slot => slot.classList.remove('selected'));
    
    // Zaznacz kliknięty
    element.classList.add('selected');
    
    // Zaktualizuj podsumowanie i idź dalej
    updateSummary();
    setTimeout(() => goToStep(3), 300);
}

// Aktualizacja tekstu podsumowania
function updateSummary() {
    const t = translations[currentLang];
    const summary = document.getElementById('summaryText');
    if(summary) {
        summary.innerHTML = `
            <strong>${t.txt_service}</strong> ${bookingData.service}<br>
            <strong>${t.txt_date}</strong> ${bookingData.date}<br>
            <strong>${t.txt_time}</strong> ${bookingData.time}
        `;
    }
}

// ==========================================
// 4. FORM SUBMISSION (Wysyłanie do serwera)
// ==========================================
const bookingForm = document.getElementById('finalBookingForm');
if(bookingForm) {
    bookingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        bookingData.name = document.getElementById('clientName').value;
        bookingData.phone = document.getElementById('clientPhone').value;

        const msgBox = document.getElementById('msgBox');
        msgBox.style.display = 'block';
        msgBox.className = 'msg-box';
        msgBox.innerText = translations[currentLang]['msg_sending'];

        try {
            // PRAWDZIWE WYSŁANIE DO SERWERA
            const response = await fetch('/api/book', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bookingData)
            });

            const result = await response.json();

            if (response.ok) {
                // Sukces
                const t = translations[currentLang];
                msgBox.className = 'msg-box msg-success';
                msgBox.innerHTML = `
                    <i class="fas fa-check-circle"></i> ${t.msg_success_1}, ${bookingData.name}!<br>
                    ${t.msg_success_2} <strong>${bookingData.service}</strong> ${t.msg_success_3}<br>
                    ${t.msg_success_4}
                `;
                document.getElementById('finalBookingForm').style.display = 'none';
            } else {
                // Błąd serwera (np. zajęty termin)
                msgBox.className = 'msg-box msg-error';
                msgBox.innerText = result.message || "Er is een fout opgetreden.";
            }

        } catch (error) {
            console.error(error);
            msgBox.className = 'msg-box msg-error';
            msgBox.innerText = "Verbindingsfout (Server offline?).";
        }
    });
}