const API_BASE = '/api/admin';
let allAppointments = [];
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0 = Styczeń, 11 = Grudzień

// Inicjalizacja przy starcie strony
document.addEventListener('DOMContentLoaded', initAdmin);

async function initAdmin() {
    await loadAppointments(); // Krok 1: Pobierz dane
    renderCalendar();         // Krok 2: Narysuj kalendarz
    renderTable();            // Krok 3: Narysuj tabelę pod spodem
}

// 1. POBIERANIE DANYCH Z API
async function loadAppointments() {
    try {
        const res = await fetch(`${API_BASE}/appointments`);
        if (!res.ok) throw new Error("Server Error");
        allAppointments = await res.json();
    } catch (error) {
        console.error("Błąd pobierania:", error);
        const tbody = document.getElementById('appointmentsList');
        if(tbody) {
            tbody.innerHTML = '<tr><td colspan="7" style="color:red; text-align:center;">Fout bij verbinden met server. (Błąd połączenia)</td></tr>';
        }
    }
}

// 2. RYSOWANIE KALENDARZA
function renderCalendar() {
    const calendarDays = document.getElementById('calendarDays');
    const monthTitle = document.getElementById('currentMonthYear');
    if (!calendarDays || !monthTitle) return;

    calendarDays.innerHTML = "";

    // Obliczanie dni w miesiącu
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Niedziela
    // Konwersja na system Poniedziałek=0 ... Niedziela=6 (Dla widoku europejskiego)
    let startingDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    // Tytuł miesiąca
    const monthNames = ["Januari", "Februari", "Maart", "April", "Mei", "Juni", "Juli", "Augustus", "September", "Oktober", "November", "December"];
    monthTitle.innerText = `${monthNames[currentMonth]} ${currentYear}`;

    // Puste kratki (dni z poprzedniego miesiąca, żeby wyrównać start)
    for (let i = 0; i < startingDay; i++) {
        const emptyDiv = document.createElement('div');
        calendarDays.appendChild(emptyDiv);
    }

    // Dni aktualnego miesiąca
    for (let day = 1; day <= daysInMonth; day++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'cal-day';
        
        // Format YYYY-MM-DD (do porównywania z bazą)
        const dateString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        dayDiv.innerHTML = `<span class="cal-day-num">${day}</span>`;

        // Filtrowanie wizyt dla tego konkretnego dnia
        const dayApps = allAppointments.filter(app => app.date === dateString);
        
        // Kolorowanie dni w zależności od statusu wizyt
        if (dayApps.length > 0) {
            const hasApproved = dayApps.some(a => a.status === 'approved');
            const hasPending = dayApps.some(a => a.status === 'pending');

            if (hasApproved) dayDiv.classList.add('has-approved'); // Zielony
            else if (hasPending) dayDiv.classList.add('has-pending'); // Pomarańczowy
            
            // Kliknięcie otwiera Modal ze szczegółami
            dayDiv.onclick = () => openDayModal(dateString, dayApps);
        }

        calendarDays.appendChild(dayDiv);
    }
}

function changeMonth(step) {
    currentMonth += step;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    } else if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    renderCalendar();
}

// 3. OBSŁUGA MODALA (SZCZEGÓŁY DNIA - Po kliknięciu w kalendarz)
function openDayModal(date, apps) {
    const modal = document.getElementById('dayModal');
    const title = document.getElementById('modalDateTitle');
    const list = document.getElementById('modalAppointments');
    
    title.innerText = `Details voor: ${date}`;
    list.innerHTML = "";

    apps.forEach(app => {
        const li = document.createElement('li');
        let statusIcon = app.status === 'approved' ? '✅' : (app.status === 'rejected' ? '❌' : '⏳');
        
        // Przycisk "Zatwierdź" tylko dla oczekujących (pending)
        let actionBtn = app.status === 'pending' 
            ? `<button onclick="quickUpdate(${app.id}, 'approved')" style="margin-left:10px; padding:5px; cursor:pointer; background:green; color:white; border:none; border-radius:3px;">Goedkeuren</button>` 
            : '';

        li.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong>${app.time}</strong> - ${app.service}<br>
                    <span style="color:#666;">${app.name}</span> <br>
                    <a href="tel:${app.phone}" style="color:var(--gold); font-weight:bold; text-decoration:none;">📞 ${app.phone}</a>
                </div>
                <div>
                    ${statusIcon} ${actionBtn}
                </div>
            </div>
        `;
        list.appendChild(li);
    });

    modal.style.display = "flex";
}

function closeModal() {
    document.getElementById('dayModal').style.display = "none";
}

// Zamknij modal klikając w tło
window.onclick = function(event) {
    const modal = document.getElementById('dayModal');
    if (event.target == modal) {
        closeModal();
    }
}

// 4. RYSOWANIE TABELI (LISTA OSTATNICH WIZYT)
function renderTable() {
    const tbody = document.getElementById('appointmentsList');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    // Sortuj: najpierw pending, potem wg daty malejąco (od najnowszej)
    const sorted = [...allAppointments].sort((a,b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return new Date(b.date) - new Date(a.date);
    });

    // Pokaż max 15 ostatnich wizyt
    const recent = sorted.slice(0, 15);

    if (recent.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Geen boekingen gevonden.</td></tr>';
        return;
    }

    recent.forEach(app => {
        const tr = document.createElement('tr');
        
        let color = '#333';
        if(app.status === 'pending') color = 'orange';
        if(app.status === 'approved') color = 'green';
        if(app.status === 'rejected') color = 'red';
        
        let actions = '-';
        if (app.status === 'pending') {
            actions = `
                <button class="action-btn btn-approve" onclick="quickUpdate(${app.id}, 'approved')" title="Goedkeuren">✔</button>
                <button class="action-btn btn-reject" onclick="quickUpdate(${app.id}, 'rejected')" title="Afwijzen">✖</button>
            `;
        }

        tr.innerHTML = `
            <td>${app.date}</td>
            <td>${app.time}</td>
            <td>${app.name}</td>
            <td><a href="tel:${app.phone}" style="color:#333; text-decoration:none; font-weight:600;">${app.phone}</a></td>
            <td>${app.service}</td>
            <td style="color:${color}; font-weight:bold">${app.status.toUpperCase()}</td>
            <td style="text-align:center;">${actions}</td>
        `;
        tbody.appendChild(tr);
    });
}

// 5. AKTUALIZACJA STATUSU (Zatwierdź / Odrzuć)
async function quickUpdate(id, status) {
    if(!confirm(`Status wijzigen naar: ${status}?`)) return;
    
    try {
        const res = await fetch(`${API_BASE}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status })
        });

        if (res.ok) {
            closeModal(); // Zamknij modal jeśli był otwarty
            initAdmin();  // Przeładuj wszystkie dane
        } else {
            alert("Er is iets misgegaan bij het opslaan.");
        }
    } catch (err) {
        console.error(err);
        alert("Server error. Controleer of de server draait.");
    }
}