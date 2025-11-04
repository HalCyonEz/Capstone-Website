// ES Module imports from CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-analytics.js";
import { getFirestore, collection, getDocs, query, where, doc, updateDoc } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBjO4P1-Ir_iJSkLScTiyshEd28GdskN24",
  authDomain: "solo-parent-app.firebaseapp.com",
  databaseURL: "https://solo-parent-app-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "solo-parent-app",
  storageBucket: "solo-parent-app.firebasestorage.app",
  messagingSenderId: "292578110807",
  appId: "1:292578110807:web:9f5e5c0dcd73c9975e6212",
  measurementId: "G-QZ9EYD02ZV"
};

// Firebase init
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', function() {
  // Toggle password visibility
  const togglePassword = document.getElementById('togglePassword');
  if (togglePassword) {
    const passwordInput = document.getElementById('password');
    togglePassword.addEventListener('click', function() {
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      // Change icon
      const icon = this.querySelector('i');
      icon.setAttribute('data-feather', type === 'password' ? 'eye' : 'eye-off');
      feather.replace();
    });
  }

  // Logout functionality
  const logoutButtons = Array.from(document.querySelectorAll('button')).filter(button =>
    button.querySelector('svg.feather-log-out')
  );
  logoutButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      const confirmLogout = confirm('Are you sure you want to log out?');
      if (confirmLogout) window.location.href = 'index.html';
    });
  });

  const sidebarToggle = document.getElementById('sidebar-toggle');
  const mobileSidebar = document.getElementById('mobile-sidebar');
  if (sidebarToggle && mobileSidebar) {
    sidebarToggle.addEventListener('click', function() {
      mobileSidebar.style.display = mobileSidebar.style.display === 'none' ? 'flex' : 'none';
      feather.replace();
    });
    mobileSidebar.addEventListener('click', function(e) {
      if (e.target === mobileSidebar) {
        mobileSidebar.style.display = 'none';
      }
    });
  }

  // ------- FIRESTORE: Display Pending Applications -------
  if (window.location.pathname.includes('dashboard.html') || window.location.pathname.includes('applications.html')) {
    const tbody = document.querySelector('tbody'); // Make sure your table has a <tbody>
    async function loadPendingApplications() {
      tbody.innerHTML = "";
      const q = query(collection(db, "users"), where("status", "==", "pending"));
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach(doc => {
        const data = doc.data();
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${data.name || ''}</td>
          <td>${data.id || ''}</td>
          <td>${data.email || ''}</td>
          <td>${data.createdAt ? new Date(data.createdAt.seconds*1000).toLocaleDateString() : ''}</td>
          <td>
            <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">${data.status}</span>
          </td>
          <td>
            <button onclick="approve('${doc.id}')">Approve</button>
            <button onclick="reject('${doc.id}')">Reject</button>
          </td>
        `;
        tbody.appendChild(row);
      });
    }
    window.approve = async function(docId) {
      await updateDoc(doc(db, "users", docId), { status: "approved" });
      loadPendingApplications();
    };
    window.reject = async function(docId) {
      await updateDoc(doc(db, "users", docId), { status: "rejected" });
      loadPendingApplications();
    };
    loadPendingApplications();
  }
});
