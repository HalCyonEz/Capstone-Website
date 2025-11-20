import { db, storage } from "./firebase-config.js";
import { initSidebar, initLogout } from "./utils.js";
import { collection, getDocs, query, orderBy, addDoc, deleteDoc, doc, Timestamp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-storage.js";

initSidebar();
initLogout();

const annForm = document.getElementById('create-announcement-form');
const annListEl = document.getElementById('announcement-list');
const annImageFile = document.getElementById('ann-image-file');

async function loadAnnouncements() {
    if (!db) return;
    annListEl.innerHTML = `<p class="text-center text-gray-500">Loading announcements...</p>`;
    try {
        const q = query(collection(db, "announcements"), orderBy("timestamp", "desc"));
        const snapshot = await getDocs(q);
        if (snapshot.empty) { annListEl.innerHTML = `<p class="text-center text-gray-500">No announcements found.</p>`; return; }
        annListEl.innerHTML = "";
        snapshot.forEach(docSnap => {
            const ann = docSnap.data();
            const date = ann.timestamp ? ann.timestamp.toDate() : new Date();
            const formattedDate = date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
            const imageHtml = ann.imageUrl ? `<img src="${ann.imageUrl}" class="w-full h-auto max-h-96 object-contain rounded-lg mt-4 mb-2 bg-gray-100">` : '';
            annListEl.innerHTML += `<div class="bg-white p-5 rounded-lg shadow-sm border border-gray-100 relative"><button data-id="${docSnap.id}" class="delete-ann-btn absolute top-4 right-4 text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-50" title="Delete Announcement"><i data-feather="trash-2" class="w-4 h-4 pointer-events-none"></i></button><h4 class="font-bold text-gray-800">${ann.title}</h4><p class="text-xs text-gray-500 mt-1">Posted on ${formattedDate}</p>${imageHtml}<p class="text-sm text-gray-700 mt-4 whitespace-pre-wrap">${ann.body}</p></div>`;
        });
        feather.replace();
        annListEl.querySelectorAll('.delete-ann-btn').forEach(btn => { btn.addEventListener('click', (e) => deleteAnnouncement(e.target.dataset.id)); });
    } catch (error) { console.error("❌ Error loading announcements:", error); }
}

async function deleteAnnouncement(annId) {
    if (confirm("Delete this announcement?")) {
        try { await deleteDoc(doc(db, "announcements", annId)); loadAnnouncements(); } catch (error) { console.error("❌ Error deleting announcement:", error); }
    }
}

if (annForm) {
    annForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('ann-title').value;
        const body = document.getElementById('ann-body').value;
        const file = annImageFile.files[0];
        let imageUrl = null;
        if (!title || !body) { alert("Title and Message Body are required."); return; }
        const submitBtn = annForm.querySelector('button[type="submit"]');
        submitBtn.textContent = "Publishing..."; submitBtn.disabled = true;
        try {
            if (file) {
                const storageRef = ref(storage, `announcements/${Date.now()}_${file.name}`);
                await uploadBytes(storageRef, file);
                imageUrl = await getDownloadURL(storageRef);
            }
            await addDoc(collection(db, "announcements"), { title: title, body: body, imageUrl: imageUrl, timestamp: Timestamp.now() });
            console.log("✅ Announcement published!"); annForm.reset(); annImageFile.value = ""; loadAnnouncements();
        } catch (error) { console.error("❌ Error publishing announcement:", error); alert("Failed: " + error.message); } finally { submitBtn.textContent = "Publish & Notify"; submitBtn.disabled = false; }
    });
}

document.addEventListener('DOMContentLoaded', loadAnnouncements);