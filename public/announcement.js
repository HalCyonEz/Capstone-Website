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

document.addEventListener('DOMContentLoaded', () => {
    loadAnnouncements();
    loadExpiringUsers();
});


// ==========================================
// MANUAL RENEWAL NOTIFICATION TRIGGER (With Custom Modal)
// ==========================================
const triggerBtn = document.getElementById('trigger-renewals-btn');
const renewalModal = document.getElementById('renewal-modal');
const confirmBtn = document.getElementById('modal-confirm-btn');
const cancelBtn = document.getElementById('modal-cancel-btn');

if (triggerBtn) {
    triggerBtn.addEventListener('click', () => {
        // Reset modal to original state
        document.getElementById('modal-msg-title').textContent = "Send Notifications?";
        document.getElementById('modal-msg-body').textContent = "Are you sure you want to trigger the renewal check and send notifications to all expiring members?";
        confirmBtn.classList.remove('hidden'); // Ensure confirm button is visible
        renewalModal.classList.remove('hidden');
        feather.replace();
    });
}

cancelBtn.addEventListener('click', () => {
    renewalModal.classList.add('hidden');
});

confirmBtn.addEventListener('click', async () => {
    // Visual loading state inside the modal
    confirmBtn.innerHTML = `<i data-feather="loader" class="w-4 h-4 animate-spin"></i>`;
    confirmBtn.disabled = true;
    feather.replace();

    try {
        await addDoc(collection(db, "system_triggers"), {
            action: "run_renewal_check",
            triggeredAt: Timestamp.now()
        });
        
        // Success state
        document.getElementById('modal-msg-title').textContent = "Success!";
        document.getElementById('modal-msg-body').textContent = "✅ Renewal checks initiated! Notifications are being sent to expiring users.";
        confirmBtn.classList.add('hidden'); // Hide confirm so they only see 'Close'
        cancelBtn.textContent = "Close";
    } catch (error) {
        console.error("Error triggering renewals:", error);
        alert("Failed to initiate check. Ensure you have network connectivity.");
        renewalModal.classList.add('hidden');
    } finally {
        confirmBtn.innerHTML = "Confirm";
        confirmBtn.disabled = false;
        feather.replace();
    }
});

// --- Load Expiring Users ---
async function loadExpiringUsers() {
    const listEl = document.getElementById('expiring-list');
    if (!listEl || !db) return;
    
    try {
        // Only fetch users who are currently approved
        const q = query(collection(db, "users")); 
        const snapshot = await getDocs(q);
        
        const now = new Date();
        const msPerDay = 1000 * 60 * 60 * 24;
        let expiringUsers = [];

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.status !== "approved") return; // Skip unapproved

            // Find the start date just like the backend does
            const baseTimestamp = data.lastRenewalDate || data.approvedAt || data.createdAt;
            if (!baseTimestamp) return;

            // Calculate expiration (1 year later)
            const baseDate = baseTimestamp.toDate();
            const expirationDate = new Date(baseDate.getTime());
            expirationDate.setFullYear(expirationDate.getFullYear() + 1);

            // Calculate exact days remaining
            const diffTime = expirationDate.getTime() - now.getTime();
            const daysRemaining = Math.ceil(diffTime / msPerDay); 

            // If they expire within 30 days (and haven't already expired)
            if (daysRemaining <= 30 && daysRemaining >= 0) {
                expiringUsers.push({
                    id: docSnap.id,
                    name: `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Unknown User',
                    expirationDate: expirationDate,
                    daysRemaining: daysRemaining
                });
            }
        });

        // Sort by nearest expiration first
        expiringUsers.sort((a, b) => a.daysRemaining - b.daysRemaining);

        // Render to table
        listEl.innerHTML = "";
        if (expiringUsers.length === 0) {
            listEl.innerHTML = `<tr><td colspan="3" class="p-6 text-center text-gray-400">No IDs expiring within the next 30 days.</td></tr>`;
            return;
        }

        expiringUsers.forEach(user => {
            const dateStr = user.expirationDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
            
            // Color code the urgency badge
            let statusBadge = '';
            if (user.daysRemaining <= 3) {
                statusBadge = `<span class="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">${user.daysRemaining} days</span>`;
            } else if (user.daysRemaining <= 14) {
                statusBadge = `<span class="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-bold">${user.daysRemaining} days</span>`;
            } else {
                statusBadge = `<span class="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">${user.daysRemaining} days</span>`;
            }

            listEl.innerHTML += `
                <tr class="hover:bg-gray-50 transition">
                    <td class="p-4 text-sm font-medium text-gray-800">${user.name}</td>
                    <td class="p-4 text-sm text-gray-600">${dateStr}</td>
                    <td class="p-4">${statusBadge}</td>
                </tr>
            `;
        });
        feather.replace();

    } catch (error) {
        console.error("❌ Error loading expiring users:", error);
        listEl.innerHTML = `<tr><td colspan="3" class="p-6 text-center text-red-500">Failed to load data.</td></tr>`;
    }
}