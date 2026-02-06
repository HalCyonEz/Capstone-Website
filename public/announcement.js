import { db, storage } from "./firebase-config.js";
import { initSidebar, initLogout } from "./utils.js";
import { collection, getDocs, query, orderBy, addDoc, deleteDoc, doc, Timestamp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-storage.js";

initSidebar();
initLogout();

const annForm = document.getElementById('create-announcement-form');
const annListEl = document.getElementById('announcement-list');
const annImageFile = document.getElementById('ann-image-file');

// Filters
const startDateInput = document.getElementById('start-date-filter');
const endDateInput = document.getElementById('end-date-filter');
const clearFilterBtn = document.getElementById('clear-date-filter');

// Cache to store data
let cachedAnnouncements = [];
let currentViewingId = null;

// --- Load Data from Firebase ---
async function loadAnnouncements() {
    if (!db) return;
    
    annListEl.innerHTML = `<div class="p-6 text-center text-gray-500">Loading announcements...</div>`;
    
    try {
        const q = query(collection(db, "announcements"), orderBy("timestamp", "desc"));
        const snapshot = await getDocs(q);
        
        cachedAnnouncements = []; // Clear cache

        if (snapshot.empty) {
            annListEl.innerHTML = `<div class="p-6 text-center text-gray-500">No announcements found.</div>`;
            return;
        }

        snapshot.forEach(docSnap => {
            cachedAnnouncements.push({ id: docSnap.id, ...docSnap.data() });
        });

        // Render full list initially
        renderAnnouncements(cachedAnnouncements);

    } catch (error) {
        console.error("❌ Error loading announcements:", error);
        annListEl.innerHTML = `<div class="p-6 text-center text-red-500">Failed to load data.</div>`;
    }
}

// --- Render Function ---
function renderAnnouncements(data) {
    annListEl.innerHTML = "";

    if (data.length === 0) {
        annListEl.innerHTML = `<div class="p-6 text-center text-gray-400">No announcements found for this period.</div>`;
        return;
    }

    data.forEach(ann => {
        const date = ann.timestamp ? ann.timestamp.toDate() : new Date();
        const dateString = date.toLocaleDateString(undefined, { 
            month: 'short', day: 'numeric', year: 'numeric' 
        });
        const timeString = date.toLocaleTimeString(undefined, { 
            hour: '2-digit', minute: '2-digit' 
        });

        const itemHTML = `
            <div class="flex items-center justify-between p-4 hover:bg-gray-50 transition duration-150 group border-b border-gray-100 last:border-0">
                <div class="flex-1 min-w-0 mr-4">
                    <h4 class="text-sm font-bold text-gray-900 truncate">${ann.title}</h4>
                    <div class="flex items-center gap-2 mt-1">
                        <span class="text-xs text-gray-500 flex items-center bg-gray-100 px-2 py-0.5 rounded">
                            <i data-feather="calendar" class="w-3 h-3 mr-1"></i> ${dateString}
                        </span>
                        <span class="text-xs text-gray-400">•</span>
                        <span class="text-xs text-gray-500">${timeString}</span>
                    </div>
                </div>
                
                <button onclick="window.openAnnouncementModal('${ann.id}')" 
                    class="flex-shrink-0 flex items-center gap-2 text-gray-500 hover:text-blue-600 transition-colors bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm hover:shadow-md text-xs font-medium">
                    View More <i data-feather="chevron-right" class="w-3 h-3"></i>
                </button>
            </div>
        `;
        annListEl.innerHTML += itemHTML;
    });
    
    feather.replace();
}

// --- Date Range Filter Logic ---
function applyDateFilter() {
    const startVal = startDateInput.value;
    const endVal = endDateInput.value;

    // Show/Hide Clear Button
    if (startVal || endVal) {
        clearFilterBtn.classList.remove('hidden');
    } else {
        clearFilterBtn.classList.add('hidden');
    }

    const filtered = cachedAnnouncements.filter(ann => {
        if (!ann.timestamp) return false;
        
        const annDate = ann.timestamp.toDate();
        // Reset annDate time to compare dates strictly if needed, 
        // OR compare full timestamps. Here we compare full timestamps roughly.
        
        let isValid = true;

        if (startVal) {
            // Create date object for start of that day (00:00:00)
            const startDate = new Date(startVal);
            startDate.setHours(0,0,0,0);
            if (annDate < startDate) isValid = false;
        }

        if (endVal) {
            // Create date object for end of that day (23:59:59)
            const endDate = new Date(endVal);
            endDate.setHours(23,59,59,999);
            if (annDate > endDate) isValid = false;
        }

        return isValid;
    });

    renderAnnouncements(filtered);
}

if (startDateInput && endDateInput) {
    startDateInput.addEventListener('change', applyDateFilter);
    endDateInput.addEventListener('change', applyDateFilter);

    // Clear Button Logic
    clearFilterBtn.addEventListener('click', () => {
        startDateInput.value = "";
        endDateInput.value = "";
        applyDateFilter(); // Resets list
    });
}

// --- Submit Logic (Same as before) ---
if (annForm) {
    annForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('ann-title').value;
        const body = document.getElementById('ann-body').value;
        const file = annImageFile.files[0];
        let imageUrl = null;

        if (!title || !body) { alert("Title and Message Body are required."); return; }

        const submitBtn = document.getElementById('publish-btn');
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.innerHTML = `<i data-feather="loader" class="w-4 h-4 animate-spin"></i> Publishing...`;
        submitBtn.disabled = true;
        feather.replace();

        try {
            if (file) {
                const storageRef = ref(storage, `announcements/${Date.now()}_${file.name}`);
                await uploadBytes(storageRef, file);
                imageUrl = await getDownloadURL(storageRef);
            }

            await addDoc(collection(db, "announcements"), {
                title: title,
                body: body,
                imageUrl: imageUrl,
                timestamp: Timestamp.now()
            });

            console.log("✅ Announcement published!");
            annForm.reset();
            annImageFile.value = "";
            loadAnnouncements(); 

        } catch (error) {
            console.error("❌ Error publishing announcement:", error);
            alert("Failed: " + error.message);
        } finally {
            submitBtn.innerHTML = originalBtnText;
            submitBtn.disabled = false;
            feather.replace();
        }
    });
}

// --- MODAL FUNCTIONS (Same as before) ---
window.openAnnouncementModal = (id) => {
    const ann = cachedAnnouncements.find(a => a.id === id);
    if (!ann) return;
    currentViewingId = id; 

    document.getElementById('modal-title').textContent = ann.title;
    const date = ann.timestamp ? ann.timestamp.toDate() : new Date();
    const fullDate = date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const fullTime = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    document.getElementById('modal-date').textContent = `Posted on ${fullDate} at ${fullTime}`;
    document.getElementById('modal-body').textContent = ann.body;

    const imgContainer = document.getElementById('modal-image-container');
    const imgEl = document.getElementById('modal-image');
    if (ann.imageUrl) {
        imgEl.src = ann.imageUrl;
        imgContainer.classList.remove('hidden');
    } else {
        imgEl.src = "";
        imgContainer.classList.add('hidden');
    }
    document.getElementById('view-announcement-modal').classList.remove('hidden');
};

window.closeAnnouncementModal = () => {
    document.getElementById('view-announcement-modal').classList.add('hidden');
    currentViewingId = null;
};

window.deleteCurrentAnnouncement = async () => {
    if (!currentViewingId) return;
    if (confirm("Are you sure you want to delete this announcement?")) {
        try {
            await deleteDoc(doc(db, "announcements", currentViewingId));
            closeAnnouncementModal();
            loadAnnouncements(); 
        } catch (error) {
            console.error("❌ Error deleting announcement:", error);
            alert("Failed to delete: " + error.message);
        }
    }
};

document.addEventListener('DOMContentLoaded', loadAnnouncements);