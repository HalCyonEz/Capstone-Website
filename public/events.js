import { db } from "./firebase-config.js";
import { initSidebar, initLogout } from "./utils.js";
import { collection, getDocs, query, where, orderBy, Timestamp, addDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

initSidebar();
initLogout();

const eventForm = document.getElementById('create-event-form');
const eventListEl = document.getElementById('active-events-list');

async function loadActiveEvents() {
    if (!db) return;
    eventListEl.innerHTML = `<p class="text-sm text-gray-500">Loading active events...</p>`;
    try {
        const q = query(collection(db, "events"), where("eventDate", ">=", Timestamp.now()), orderBy("eventDate", "asc"));
        const snapshot = await getDocs(q);
        if (snapshot.empty) { eventListEl.innerHTML = `<p class="text-sm text-gray-500">No active events found.</p>`; return; }
        eventListEl.innerHTML = "";
        snapshot.forEach(docSnap => {
            const event = docSnap.data();
            const date = event.eventDate.toDate();
            const formattedDate = date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
            eventListEl.innerHTML += `<div class="bg-white p-5 rounded-lg shadow-sm border border-gray-100"><div class="flex justify-between items-start"><div class="flex items-start gap-4"><div class="bg-green-100 text-green-800 p-3 rounded-full"><i data-feather="calendar" class="w-5 h-5"></i></div><div><h3 class="font-bold text-gray-800">${event.eventName}</h3><p class="text-sm text-gray-500 mt-1">${formattedDate} • ${event.eventTime}</p><p class="text-sm text-gray-700 mt-1">${event.eventLocation || 'No location specified'}</p><p class="text-sm text-gray-600 mt-2">${event.eventDescription || ''}</p></div></div><div class="flex gap-2"><button data-id="${docSnap.id}" class="delete-event-btn text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-50"><i data-feather="trash-2" class="w-4 h-4 pointer-events-none"></i></button></div></div></div>`;
        });
        feather.replace();
        eventListEl.querySelectorAll('.delete-event-btn').forEach(btn => { btn.addEventListener('click', (e) => deleteEvent(e.target.dataset.id)); });
    } catch (error) { console.error("❌ Error loading active events:", error); }
}

async function deleteEvent(eventId) {
    if (confirm("Are you sure you want to delete this event?")) {
        try { await deleteDoc(doc(db, "events", eventId)); loadActiveEvents(); } catch (error) { console.error("❌ Error deleting event:", error); }
    }
}

if (eventForm) {
    eventForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('event-title').value;
        const dateValue = document.getElementById('event-date').value;
        const timeValue = document.getElementById('event-time').value;
        const location = document.getElementById('event-location').value;
        const description = document.getElementById('event-description').value;
        if (!title || !dateValue || !timeValue) { alert("Please fill in at least the Event Title, Date, and Time."); return; }
        try {
            const combinedDate = new Date(dateValue + 'T' + timeValue);
            const eventTimestamp = Timestamp.fromDate(combinedDate);
            await addDoc(collection(db, "events"), { eventName: title, eventDate: eventTimestamp, eventTime: timeValue, eventLocation: location, eventDescription: description, createdAt: Timestamp.now() });
            console.log("✅ Event created successfully!"); eventForm.reset(); loadActiveEvents();
        } catch (error) { console.error("❌ Error creating event:", error); }
    });
}

document.addEventListener('DOMContentLoaded', loadActiveEvents);