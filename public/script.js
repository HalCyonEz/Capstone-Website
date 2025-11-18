// ES Module imports from CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-analytics.js";
import {
 getFirestore, collection, getDocs, query,
 where, doc, updateDoc, Timestamp, orderBy, limit,
 addDoc, deleteDoc, getDoc
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

// Your Firebase config
const firebaseConfig = {
 apiKey: "AIzaSyBjO4P1-Ir_iJSkLScTiyshEd28GdskN24",
 authDomain: "solo-parent-app.firebaseapp.com",
 databaseURL: "https://solo-parent-app-default-rtdb.asia-southeast1.firebasedabase.app",
 projectId: "solo-parent-app",
 storageBucket: "solo-parent-app.firebasestorage.app",
 messagingSenderId: "292578110807",
 appId: "1:292578110807:web:9f5e5c0dcd73c9975e6212",
 measurementId: "G-QZ9EYD02ZV"
};

// Firebase init
let app, analytics, db;
try {
 app = initializeApp(firebaseConfig);
 analytics = getAnalytics(app);
 db = getFirestore(app);
 console.log("✅ Firebase initialized successfully");
} catch (error) {
 console.error("❌ Firebase initialization error:", error);
}

// --- ✅ NEW GLOBAL VARIABLES ---
const DESCRIPTION_TO_CODE_MAP = {
  "a1: Birth of a child as a consequence of rape": "a1",
  "a2: Widow/widower": "a2",
  "a3: Spouse of person deprived of liberty": "a3",
  "a4: Spouse of person with physical or mental incapacity": "a4",
  "a5: Due to legal separation or de facto separation": "a5",
  "a6: Due to nullity or annulment of marriage": "a6",
  "a7: Abandonment by the spouse": "a7",
  "b1: Spouse of OFW": "b1",
  "b2: Relative of OFW": "b2",
  "c: Unmarried person": "c",
  "d: Legal guardian / Adoptive parent / Foster parent": "d",
  "f: Pregnant Woman": "f"
};

const CODE_TO_DESCRIPTION_MAP = {};
for (const description in DESCRIPTION_TO_CODE_MAP) {
  const code = DESCRIPTION_TO_CODE_MAP[description];
  CODE_TO_DESCRIPTION_MAP[code] = description;
}
// --- END OF NEW GLOBAL VARIABLES ---

// --------------------------------------------------------------------------
// GLOBAL HELPER FUNCTIONS
// --------------------------------------------------------------------------
async function approveUser(docId) {
 try {
  await updateDoc(doc(db, "users", docId), {
  status: "approved",
  approvedAt: Timestamp.now()
  });
  console.log('✅ Application approved successfully!');
  location.reload();
 } catch (error) {
  console.error('❌ Error approving:', error);
 }
}

async function rejectUser(docId) {
 try {
  await updateDoc(doc(db, "users", docId), { status: "rejected" });
  console.log('✅ Application rejected.');
  location.reload();
 } catch (error) {
  console.error('❌ Error rejecting:', error);
 }
}

// --------------------------------------------------------------------------
// UTILITY FUNCTIONS (Run on all pages)
// --------------------------------------------------------------------------
function isPage(pageName) {
 return window.location.pathname.endsWith(pageName);
}

function handleSidebarHighlight() {
 const sidebarLinks = document.querySelectorAll('nav a');
 const currentPath = window.location.pathname;
 sidebarLinks.forEach(link => {
  link.classList.remove('bg-blue-50', 'text-blue-700');
  link.classList.add('text-gray-600');
  const href = link.getAttribute('href');
  
  if (currentPath.endsWith(href)) {
  link.classList.add('bg-blue-50', 'text-blue-700');
  link.classList.remove('text-gray-600');
  }
 
  if (isPage('profile.html') && (href === 'categories.html' || href === 'members.html')) {
  link.classList.add('bg-blue-50', 'text-blue-700');
  link.classList.remove('text-gray-600');
  }
  });
}

function handleMobileSidebar() {
 const sidebarToggle = document.getElementById('sidebar-toggle');
 const mobileSidebar = document.getElementById('mobile-sidebar');
 if (sidebarToggle && mobileSidebar) {
  sidebarToggle.addEventListener('click', function() {
  mobileSidebar.style.display = mobileSidebar.style.display === 'none' ? 'flex' : 'none';
  });
  mobileSidebar.addEventListener('click', function(e) {
  if (e.target === mobileSidebar) {
  mobileSidebar.style.display = 'none';
  }
  });
 }
}

function handleLogout() {
 const logoutButtons = Array.from(document.querySelectorAll('button')).filter(button =>
  button.textContent.includes('Log Out') || button.querySelector('i[data-feather="log-out"]')
 );
 logoutButtons.forEach(button => {
  button.addEventListener('click', function(e) {
  e.preventDefault();
  window.location.href = 'index.html';
  });
 });
}

function handlePasswordToggle() {
 const togglePassword = document.getElementById('togglePassword');
 if (togglePassword) {
  const passwordInput = document.getElementById('password');
  togglePassword.addEventListener('click', function() {
  const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
  passwordInput.setAttribute('type', type);
  const icon = this.querySelector('i');
  icon.setAttribute('data-feather', type === 'password' ? 'eye' : 'eye-off');
  feather.replace();
  });
 }
}

// --------------------------------------------------------------------------
// DASHBOARD PAGE LOGIC (`dashboard.html`) --- ✅ NEWLY UPDATED
// --------------------------------------------------------------------------
async function initDashboardPage() {
  console.log("🚀 Initializing Dashboard...");

  let allUsersData = []; // Caches all user data
  let donutChartInstance = null; // Holds the chart object

  // --- 1. Functions to FETCH data ---

  // Fetches all users ONCE and stores them
  async function fetchAllUsers() {
    if (!db) return;
    try {
      const usersCollection = collection(db, "users");
      const snapshot = await getDocs(usersCollection);
      allUsersData = snapshot.docs.map(doc => doc.data());
    } catch (error) {
      console.error("❌ Error fetching all users:", error);
    }
  }

  // Fetches upcoming events (this is independent of date filters)
  async function fetchUpcomingEvents() {
    const eventsList = document.getElementById('upcoming-events-list');
    const eventsCountEl = document.getElementById('events-count');
    const nextEventEl = document.getElementById('next-event-text');
    if (!eventsList || !eventsCountEl || !nextEventEl) return;
    
    eventsList.innerHTML = `<p class="text-sm text-gray-500">Loading upcoming events...</p>`;
    try {
      const eventsQuery = query(collection(db, "events"),
        where("eventDate", ">=", Timestamp.now()),
        orderBy("eventDate", "asc")
      );
      const snapshot = await getDocs(eventsQuery);

      eventsCountEl.textContent = snapshot.size;
      
      if (snapshot.empty) {
        nextEventEl.textContent = "No upcoming events";
        eventsList.innerHTML = `<p class="text-sm text-gray-500">No upcoming events found.</p>`;
        return;
      }
      
      // Populate the "Next Event" text on the stat card
      const nextEvent = snapshot.docs[0].data();
      nextEventEl.textContent = `Next: ${nextEvent.eventName}`;

      // Populate the event list
      eventsList.innerHTML = "";
      const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
      snapshot.forEach(doc => {
        const event = doc.data();
        const eventDate = event.eventDate.toDate();
        const day = eventDate.getDate();
        const month = monthNames[eventDate.getMonth()];
        const eventHtml = `
          <div class="flex items-start">
            <div class="bg-blue-100 p-3 rounded-lg mr-4">
              <i data-feather="calendar" class="text-blue-600"></i>
            </div>
            <div>
              <h3 class="font-medium text-gray-800">${event.eventName}</h3>
              <p class="text-sm text-gray-600">${eventDate.toLocaleDateString()} | ${event.eventTime || ''}</p>
              <p class="text-xs text-gray-500 mt-1">${event.eventLocation || 'Online'}</p>
            </div>
          </div>`;
        eventsList.innerHTML += eventHtml;
      });
      feather.replace();

    } catch (error) {
      console.error("❌ Error loading upcoming events:", error);
      eventsList.innerHTML = `<p class="text-sm text-red-500">Error loading events.</p>`;
    }
  }

  // --- 2. Functions to UPDATE the UI ---

  // Creates the donut chart shell (called once)
  function initDonutChart() {
    const ctx = document.getElementById('donutChart').getContext('2d');
    donutChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Approved', 'Pending', 'Rejected'],
        datasets: [{
          data: [0, 0, 0], // Start empty
          backgroundColor: ['#10B981', '#F59E0B', '#EF4444'],
          borderWidth: 0,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: { display: false }
        }
      }
    });
  }

  // ✅ NEW: This function now just builds the table from a given list
  function updateRecentActivity(users) {
    const tableBody = document.getElementById('recent-activity-table');
    if (!tableBody) return;
    
    if (!users || users.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="4" class="px-6 py-4 text-center text-gray-500">No recent activity for this period.</td></tr>`;
      return;
    }
    
    tableBody.innerHTML = "";
    users.forEach(user => { // users is the pre-filtered, pre-sorted list
      const name = `${user.firstName || ''} ${user.lastName || ''}`;
      const date = user.createdAt.toDate().toLocaleDateString();

      let statusText = 'Pending';
      let statusClass = 'bg-yellow-100 text-yellow-800';

      if (user.status === 'approved') {
          statusText = 'Approved';
          statusClass = 'bg-green-100 text-green-800';
      } else if (user.status === 'rejected') {
          statusText = 'Rejected';
          statusClass = 'bg-red-100 text-red-800';
      }
      
      const row = `
        <tr>
          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${name}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">New Application</td>
          <td class="px-6 py-4 whitespace-nowrap">
            <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}">${statusText}</span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${date}</td>
        </tr>`;
      tableBody.innerHTML += row;
    });
  }
  
  // This function now filters for stats AND for recent activity
  function updateDashboardStats(filter) {
    let startDate, endDate;
    const now = new Date();
    
    // 1. Determine date range
    if (filter === 'this_month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (filter === 'this_year') {
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    } else if (filter === 'custom') {
      const startVal = document.getElementById('start-date').value;
      const endVal = document.getElementById('end-date').value;
      if (!startVal || !endVal) {
        alert("Please select both a start and end date.");
        return;
      }
      startDate = new Date(startVal + "T00:00:00");
      endDate = new Date(endVal + "T23:59:59");
    }

    // 2. Filter data for Stat Cards
    let registeredCount = 0;
    let pendingCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;

    registeredCount = allUsersData.filter(u => {
        const createdAt = u.createdAt?.toDate();
        if (!createdAt) return false;
        return (filter === 'all') ? true : (createdAt >= startDate && createdAt <= endDate);
    }).length;

    pendingCount = allUsersData.filter(u => {
        if (u.status !== 'pending') return false;
        const createdAt = u.createdAt?.toDate();
        if (!createdAt) return false;
        return (filter === 'all') ? true : (createdAt >= startDate && createdAt <= endDate);
    }).length;

    approvedCount = allUsersData.filter(u => {
        if (u.status !== 'approved') return false;
        const approvedAt = u.approvedAt?.toDate();
        if (!approvedAt) return false;
        return (filter === 'all') ? true : (approvedAt >= startDate && approvedAt <= endDate);
    }).length;
    
    rejectedCount = allUsersData.filter(u => {
        if (u.status !== 'rejected') return false;
        const createdAt = u.createdAt?.toDate();
        if (!createdAt) return false;
        return (filter === 'all') ? true : (createdAt >= startDate && createdAt <= endDate);
    }).length;
    
    // 3. Update the Stat Cards
    document.getElementById('registered-count').textContent = registeredCount;
    document.getElementById('pending-count').textContent = pendingCount;
    document.getElementById('approved-count').textContent = approvedCount;

    // 4. Update the Donut Chart
    const total = approvedCount + pendingCount + rejectedCount;
    const approvedPercent = total === 0 ? 0 : Math.round((approvedCount / total) * 100);
    const pendingPercent = total === 0 ? 0 : Math.round((pendingCount / total) * 100);
    const rejectedPercent = (total === 0 || (approvedPercent + pendingPercent) > 100) ? 0 : (100 - approvedPercent - pendingPercent);

    if (donutChartInstance) {
      donutChartInstance.data.datasets[0].data = [approvedCount, pendingCount, rejectedCount];
      donutChartInstance.update();
    }
    document.getElementById('chart-label-approved').textContent = `Approved (${approvedPercent}%)`;
    document.getElementById('chart-label-pending').textContent = `Pending (${pendingPercent}%)`;
    document.getElementById('chart-label-rejected').textContent = `Rejected (${rejectedPercent}%)`;

    // 5. ✅ NEW: Filter and update the Recent Activity table
    const activityUsers = allUsersData.filter(u => {
        const createdAt = u.createdAt?.toDate();
        if (!createdAt) return false;
        return (filter === 'all') ? true : (createdAt >= startDate && createdAt <= endDate);
    });
    
    // Sort by creation date (newest first) and take top 5
    const sortedActivityUsers = activityUsers
        .sort((a, b) => b.createdAt.toDate() - a.createdAt.toDate())
        .slice(0, 5);
        
    updateRecentActivity(sortedActivityUsers); // Call the new update function
  }

  // --- 3. Setup Event Listeners ---
  function setupEventListeners() {
    const dateSelect = document.getElementById('date-range-select');
    const customRangeDiv = document.getElementById('custom-date-range');
    const applyBtn = document.getElementById('apply-custom-date');

    dateSelect.addEventListener('change', function() {
      const filterValue = this.value;
      if (filterValue === 'custom') {
        customRangeDiv.classList.remove('hidden');
        customRangeDiv.classList.add('sm:flex');
      } else {
        customRangeDiv.classList.add('hidden');
        customRangeDiv.classList.remove('sm:flex');
        updateDashboardStats(filterValue);
      }
    });

    applyBtn.addEventListener('click', function() {
      updateDashboardStats('custom');
    });
  }

  // --- 4. Initial Page Load ---
  initDonutChart();       // Create the empty chart
  setupEventListeners();  // Set up the filter buttons
  fetchUpcomingEvents();  // Load events (independent)
  
  // Fetch all user data, then update stats (which now includes recent activity)
  await fetchAllUsers();
  updateDashboardStats('this_month'); // This will load stats AND recent activity
}

// --------------------------------------------------------------------------
// APPLICATIONS PAGE LOGIC (`applications.html`)
// --------------------------------------------------------------------------
function initApplicationsPage() {
  console.log("🚀 Initializing Applications Page...");
  const tbody = document.getElementById('applications-table-body');
  if (!tbody) {
    console.error('❌ Table body "#applications-table-body" not found.');
    return;
  }
  async function loadPendingApplications() {
    if (!db) {
      tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-red-500">Database connection error.</td></tr>`;
      return;
    }
    tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500">Loading applications...</td></tr>';
    try {
      const q = query(collection(db, "users"), where("status", "==", "pending"));
      const querySnapshot = await getDocs(q);
      tbody.innerHTML = "";
      if (querySnapshot.size === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500">No pending applications found.</td></tr>`;
        return;
      }
      querySnapshot.forEach(docSnapshot => {
        const data = docSnapshot.data();
        const name = `${data.firstName || ''} ${data.lastName || ''}`;
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';
        
        row.innerHTML = `
          <td class="px-6 py-4 whitespace-nowrap">
            <input type="checkbox" class="rounded text-blue-600 focus:ring-blue-500">
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <div class="flex items-center">
              <div class="ml-4">
                <div class="text-sm font-medium text-gray-900">${name}</div>
              </div>
            </div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <div class="text-sm text-gray-900">${data.soloParentIdNumber || 'N/A'}</div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <div class="text-sm text-gray-900">${data.createdAt ? data.createdAt.toDate().toLocaleDateString() : 'N/A'}</div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Pending</span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
            <div class="flex justify-end items-center space-x-3">
              <a href="profile.html?id=${docSnapshot.id}" target="_blank" class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
                View
              </a>
              <button data-action="approve" data-id="${docSnapshot.id}" class="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700">
                Approve
              </button>
              <button data-action="reject" data-id="${docSnapshot.id}" class="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700">
                Reject
              </button>
            </div>
          </td>
        `;
        tbody.appendChild(row);
      });

      tbody.querySelectorAll('[data-action="approve"]').forEach(btn => {
        btn.addEventListener('click', () => approveUser(btn.dataset.id));
      });
      tbody.querySelectorAll('[data-action="reject"]').forEach(btn => {
        btn.addEventListener('click', () => rejectUser(btn.dataset.id));
      });
    } catch (error) {
      console.error('❌ Error loading applications:', error);
      tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-red-500">Error: ${error.message}</td></tr>`;
    }
  }

  loadPendingApplications();
}

// --------------------------------------------------------------------------
// MEMBERS PAGE LOGIC (`members.html`)
// --------------------------------------------------------------------------
function initMembersPage() {
 console.log("🚀 Initializing Members Page...");
 const tableBody = document.getElementById('members-table-body');
 if (!tableBody) {
  console.error('❌ Table body "#members-table-body" not found.');
  return;
 }
 async function loadVerifiedMembers() {
  if (!db) {
  tableBody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-red-500">Database connection error.</td></tr>`;
  return;
  }
  tableBody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500">Loading members...</td></tr>';
  try {
  const q = query(collection(db, "users"), where("status", "==", "approved"));
  const querySnapshot = await getDocs(q);
  document.getElementById('total-verified-members').textContent = querySnapshot.size;
  document.getElementById('pagination-total').textContent = querySnapshot.size;
  document.getElementById('total-verified-percent').textContent = "Total";
  tableBody.innerHTML = "";
  if (querySnapshot.size === 0) {
  tableBody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500">No verified members found.</td></tr>`;
  return;
  }
  querySnapshot.forEach(docSnapshot => {
  const data = docSnapshot.data();
  const name = `${data.firstName || ''} ${data.lastName || ''}`;
  
  // ✅ Use the code map to display the full category description
  const categoryDescription = CODE_TO_DESCRIPTION_MAP[data.category] || data.category || 'N/A';
  
  const address = data.address || 'N/A';
  const soloParentId = data.soloParentIdNumber || 'N/A';
  const project = data.projectReceived || 'N/A';
  const row = document.createElement('tr');
  row.className = 'hover:bg-gray-50';
  row.innerHTML = `
  <td class="px-6 py-4 whitespace-nowrap"><div class="flex items-center"><div class="ml-4"><div class="text-sm font-medium text-gray-900">${name}</div><div class="text-sm text-gray-500">${categoryDescription}</div></div></div></td>
  <td class="px-6 py-4 whitespace-nowrap"><div class="text-sm text-gray-900">${address}</div></td>
  <td class="px-6 py-4 whitespace-nowrap"><div class="text-sm text-gray-900">${soloParentId}</div></td>
  <td class="px-6 py-4 whitespace-nowrap"><div class="text-sm text-gray-900">${project}</div></td>
  <td class="px-6 py-4 whitespace-nowrap"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Verified</span></td>
  <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
  <div class="flex justify-end space-x-2">
  <a href="profile.html?id=${docSnapshot.id}" class="text-blue-600 hover:text-blue-900" title="View Details">
  <i data-feather="eye" class="w-4 h-4"></i>
  </a>
  <a href="#" class="text-blue-600 hover:text-blue-900" title="Edit Member">
  <i data-feather="edit" class="w-4 h-4"></i>
  </a>
  </div>
  </td>
  `;
  tableBody.appendChild(row);
  });
  feather.replace();
  } catch (error) {
  console.error('❌ Error loading members:', error);
  tableBody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-red-500">Error: ${error.message}</td></tr>`;
  }
 }
  loadVerifiedMembers();
}

// --------------------------------------------------------------------------
// CATEGORIES PAGE LOGIC (`categories.html`)
// --------------------------------------------------------------------------
function initCategoriesPage() {
  console.log("🚀 Initializing Categories Page...");

  // The maps are global now, so we can use them.
  // We just need the list of descriptions for the UI.
  const CATEGORY_LIST = Object.keys(DESCRIPTION_TO_CODE_MAP);
  const MUNICIPALITY_LIST = [ "Atok", "Bakun", "Bokod", "Buguias", "Itogon", "Kabayan", "Kapangan", "Kibungan", "La Trinidad", "Mankayan", "Sablan", "Tuba", "Tublay" ];

  const categoryListEl = document.getElementById('category-filter-list');
  const municipalitySelectEl = document.getElementById('municipality-filter-select');
  const memberGridEl = document.getElementById('member-profile-grid');
  const searchBoxEl = document.getElementById('search-box');
  const filterTagsEl = document.getElementById('filter-tags-container');
  const resetFiltersBtn = document.getElementById('reset-filters-btn');

  let allApprovedMembers = [];
  let currentCategory = "All"; 
  let currentMunicipality = "All";
  let currentSearch = "";

  async function loadAllData() {
    if (!db) {
      memberGridEl.innerHTML = `<p class="text-sm text-red-500">Database connection error.</p>`;
      return;
    }
    try {
      const q = query(collection(db, "users"), where("status", "==", "approved"));
      const snapshot = await getDocs(q);
      allApprovedMembers = snapshot.docs;

      const categoryCounts = {};
      const municipalityCounts = {};
      CATEGORY_LIST.forEach(c => categoryCounts[c] = 0);
      MUNICIPALITY_LIST.forEach(m => municipalityCounts[m] = 0);
      
      allApprovedMembers.forEach(doc => {
        const data = doc.data();
        
        const code = data.category;
        const description = CODE_TO_DESCRIPTION_MAP[code];
        
        if (description && categoryCounts[description] !== undefined) {
          categoryCounts[description]++;
        } else if (data.category) {
          console.warn(`Unknown category code in database: "${data.category}"`);
        }

        const location = data.municipality || data.placeOfBirth;
        if (municipalityCounts[location] !== undefined) {
          municipalityCounts[location]++;
        }
      });

      renderCategoryFilters(categoryCounts);
      renderMunicipalityFilters(municipalityCounts, allApprovedMembers.length);
      applyFiltersAndRender();
      addFilterListeners();
    } catch (error) {
      console.error("❌ Error loading categories page:", error);
      memberGridEl.innerHTML = `<p class="text-sm text-red-500">Error loading data: ${error.message}</p>`;
    }
  }

  function renderCategoryFilters(counts) {
    categoryListEl.innerHTML = "";
    let total = allApprovedMembers.length;
    categoryListEl.innerHTML += `
      <a href="#" data-category="All" class="flex justify-between items-center px-3 py-2 
        rounded-md bg-blue-50 text-blue-700 category-link">
        <span>All Categories</span>
        <span class="text-xs font-medium">${total}</span>
      </a>`;
    for (const description of CATEGORY_LIST) {
      const code = DESCRIPTION_TO_CODE_MAP[description];
      const count = counts[description] || 0;
      categoryListEl.innerHTML += `
        <a href="#" data-category="${description}" class="flex justify-between items-center px-3 py-2 rounded-md hover:bg-gray-50 category-link">
          <span class="flex items-start">
            <span class="text-xs font-mono w-8 text-gray-400 flex-shrink-0">${code}</span>
            <span class="ml-1">${description}</span>
          </span>
          <span class="text-xs font-medium text-gray-500">${count}</span>
        </a>`;
    }
  }

  function renderMunicipalityFilters(counts, total) {
    municipalitySelectEl.innerHTML = "";
    municipalitySelectEl.innerHTML += `<option value="All">All Municipalities (${total})</option>`;
    MUNICIPALITY_LIST.forEach(municipality => {
      const count = counts[municipality] || 0;
      municipalitySelectEl.innerHTML += `<option value="${municipality}">${municipality} (${count})</option>`;
    });
  }

  function renderMemberProfiles(members) {
    memberGridEl.innerHTML = "";
    if (members.length === 0) {
      memberGridEl.innerHTML = `<p class="text-sm text-gray-500">No members found matching your filters.</p>`;
      return;
    }
    members.forEach(doc => {
      const data = doc.data();
      const name = `${data.firstName || ''} ${data.lastName || ''}`;
      const location = data.address || 'N/A';
      const soloParentId = data.soloParentIdNumber || 'N/A';
      memberGridEl.innerHTML += `
        <div class="bg-white p-4 rounded-lg shadow-sm border border-gray-100 
          hover:border-blue-200 transition">
          <div class="flex items-start gap-4">
            <img src="${data.profileImageUrl || 'https://i.pravatar.cc/200'}" class="w-16 
              h-16 rounded-full object-cover">
            <div class="flex-1">
              <h3 class="font-semibold text-gray-800">${name}</h3>
              <p class="text-sm text-gray-500">ID: ${soloParentId}</p>
              <p class="text-sm text-gray-500 mt-1">${location}</p>
            </div>
          </div>
          <div class="mt-4">
            <a href="profile.html?id=${doc.id}" 
              class="w-full block text-center py-2 px-4 
              border border-blue-600 text-blue-600 font-medium rounded-md hover:bg-blue-50 
              transition">
              View Profile
            </a>
          </div>
        </div>`;
    });
  }

  function applyFiltersAndRender() {
    let filteredMembers = allApprovedMembers;
    
    if (currentCategory !== "All") {
      const currentCode = DESCRIPTION_TO_CODE_MAP[currentCategory];
      filteredMembers = filteredMembers.filter(doc => doc.data().category === currentCode);
    }

    if (currentMunicipality !== "All") {
      const locationField = allApprovedMembers[0]?.data().municipality ? 'municipality' : 'placeOfBirth';
      filteredMembers = filteredMembers.filter(doc => doc.data()[locationField] === currentMunicipality);
    }

    if (currentSearch) {
      const lowerCaseSearch = currentSearch.toLowerCase();
      filteredMembers = filteredMembers.filter(doc => {
        const data = doc.data();
        const name = `${data.firstName || ''} ${data.lastName || ''}`.toLowerCase();
        const id = (data.soloParentIdNumber || '').toLowerCase();
        return name.includes(lowerCaseSearch) || id.includes(lowerCaseSearch);
      });
    }
    
    renderMemberProfiles(filteredMembers);
    updateFilterTags();
  }

  function updateFilterTags() {
    filterTagsEl.innerHTML = "";
    let filtersActive = false;
    if (currentCategory !== "All") {
      filterTagsEl.innerHTML += `<span class="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs">${currentCategory}</span>`;
      filtersActive = true;
    }
    if (currentMunicipality !== "All") {
      filterTagsEl.innerHTML += `<span class="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs">${currentMunicipality}</span>`;
      filtersActive = true;
    }
    filterTagsEl.appendChild(resetFiltersBtn);
    resetFiltersBtn.style.display = filtersActive ? 'flex' : 'none';
  }

  function addFilterListeners() {
    categoryListEl.addEventListener('click', e => {
      e.preventDefault();
      const link = e.target.closest('.category-link');
      if (!link) return;
      currentCategory = link.dataset.category;
      document.querySelectorAll('.category-link').forEach(l => {
        l.classList.remove('bg-blue-50', 'text-blue-700');
        l.classList.add('hover:bg-gray-50');
        l.querySelector('span:last-child').classList.add('text-gray-500');
      });
      link.classList.add('bg-blue-50', 'text-blue-700');
      link.classList.remove('hover:bg-gray-50');
      link.querySelector('span:last-child').classList.remove('text-gray-500');
      applyFiltersAndRender();
    });
    municipalitySelectEl.addEventListener('change', e => {
      currentMunicipality = e.target.value;
      applyFiltersAndRender();
    });
    searchBoxEl.addEventListener('input', e => {
      currentSearch = e.target.value;
      applyFiltersAndRender();
    });
    resetFiltersBtn.addEventListener('click', e => {
      e.preventDefault();
      currentCategory = "All";
      currentMunicipality = "All";
      currentSearch = "";
      searchBoxEl.value = "";
      municipalitySelectEl.value = "All";
      document.querySelectorAll('.category-link').forEach(l => {
        l.classList.remove('bg-blue-50', 'text-blue-700');
      });
      document.querySelector('.category-link[data-category="All"]').click();
      applyFiltersAndRender();
    });
  }

  loadAllData();
}

// --------------------------------------------------------------------------
// EVENTS PAGE LOGIC (`events.html`)
// --------------------------------------------------------------------------
function initEventsPage() {
 console.log("🚀 Initializing Events Page...");
 const eventForm = document.getElementById('create-event-form');
 const eventListEl = document.getElementById('active-events-list');
 async function loadActiveEvents() {
  if (!db) {
  eventListEl.innerHTML = `<p class="text-sm text-red-500">Database connection error.</p>`;
  return;
  }
  eventListEl.innerHTML = `<p class="text-sm text-gray-500">Loading active events...</p>`;
  try {
  const q = query(collection(db, "events"),
  where("eventDate", ">=", Timestamp.now()),
  orderBy("eventDate", "asc")
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
  eventListEl.innerHTML = `<p class="text-sm text-gray-500">No active events found.</p>`;
  return;
  }
  eventListEl.innerHTML = "";
  snapshot.forEach(doc => {
  const event = doc.data();
  const eventId = doc.id;
  const date = event.eventDate.toDate();
  const formattedDate = date.toLocaleDateString(undefined, {
  year: 'numeric', month: 'long', day: 'numeric'
  });
  const formattedTime = event.eventTime;
  eventListEl.innerHTML += `
  <div class="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
  <div class="flex justify-between items-start">
  <div class="flex items-start gap-4">
  <div class="bg-green-100 text-green-800 p-3 rounded-full"><i data-feather="calendar" class="w-5 h-5"></i></div>
  <div>
  <h3 class="font-bold text-gray-800">${event.eventName}</h3>
  <p class="text-sm text-gray-500 mt-1">${formattedDate} • ${formattedTime}</p>
  <p class="text-sm text-gray-700 mt-1">${event.eventLocation || 'No location specified'}</p>
  <p class="text-sm text-gray-600 mt-2">${event.eventDescription || ''}
 </p>
  </div>
  </div>
  <div class="flex gap-2">
  <button data-id="${eventId}" class="edit-event-btn text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-50" title="Edit Event">
  <i data-feather="edit" class="w-4 h-4 pointer-events-none"></i>
  </button>
  <button data-id="${eventId}" class="delete-event-btn text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-50" title="Delete Event">
  <i data-feather="trash-2" class="w-4 h-4 pointer-events-none"></i>
  </button>
  </div>
  </div>
  </div>`;
  });
  addDynamicButtonListeners();
  feather.replace();
  } catch (error) {
  console.error("❌ Error loading active events:", error);
  eventListEl.innerHTML = `<p class="text-sm text-red-500">Error loading events. ${error.message}</p>`;
  if (error.code === 'failed-precondition') {
  console.warn("Firestore index missing. Check console (F12) for a link to create it.");
  }
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
  if (!title || !dateValue || !timeValue) {
  console.error("Title, Date, and Time are required.");
  return;
  }
  try {
  const combinedDate = new Date(dateValue + 'T' + timeValue);
  const eventTimestamp = Timestamp.fromDate(combinedDate);
  const eventData = {
  eventName: title,
  eventDate: eventTimestamp,
  eventTime: timeValue,
  eventLocation: location,
  eventDescription: description,
  createdAt: Timestamp.now()
  };
  await addDoc(collection(db, "events"), eventData);
  console.log("✅ Event created successfully!");
  eventForm.reset();
  loadActiveEvents();
  } catch (error) {
  console.error("❌ Error creating event:", error);
  }
  });
 }
  async function deleteEvent(eventId) {
  try {
  await deleteDoc(doc(db, "events", eventId));
  console.log("Event deleted successfully.");
  loadActiveEvents();
  } catch (error) {
  console.error("❌ Error deleting event:", error);
  }
  }
  function addDynamicButtonListeners() {
  eventListEl.querySelectorAll('.delete-event-btn').forEach(btn => {
  btn.addEventListener('click', (e) => deleteEvent(e.target.dataset.id));
  });
  eventListEl.querySelectorAll('.edit-event-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
  console.log("Edit functionality is not yet implemented. Event ID:", e.target.dataset.id);
  });
  });
  }
  loadActiveEvents();
}

// --------------------------------------------------------------------------
// PROFILE PAGE LOGIC (`profile.html`)
// --------------------------------------------------------------------------
async function initProfilePage() {
 console.log("🚀 Initializing Profile Page...");
 const params = new URLSearchParams(window.location.search);
 const userId = params.get('id');
 const breadcrumb = document.getElementById('profile-breadcrumb');
 const actionsDiv = document.getElementById('profile-actions');
 const approveBtn = document.getElementById('profile-approve-btn');
 const rejectBtn = document.getElementById('profile-reject-btn');
 const editBtn = document.getElementById('profile-edit-btn');
 const printBtn = document.getElementById('print-profile-btn');
 
  if (!userId) {
  breadcrumb.textContent = "Error: No user ID provided.";
  actionsDiv.innerHTML = `<p class="text-sm text-red-500">Could not load user actions.</p>`;
  return;
 }
 
  if (printBtn) {
  printBtn.addEventListener('click', () => {
  window.print();
  });
 }

 breadcrumb.textContent = `Loading profile for ID: ${userId}`;
 try {
  const docRef = doc(db, "users", userId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
  breadcrumb.textContent = "Error: User not found.";
  actionsDiv.innerHTML = `<p class="text-sm text-red-500">Could not find user.</p>`;
  return;
  }
  const user = docSnap.data();
  const fullName = `${user.firstName || ''} ${user.middleInitial || ''} ${user.lastName || ''}`;
  breadcrumb.textContent = `Viewing profile for ${fullName}`;
  
  const setText = (id, text) => {
  const el = document.getElementById(id);
  if (el) el.textContent = text || 'N/A';
  };
  
  const setDoc = (id, url) => {
  const link = document.getElementById(`doc-link-${id}`);
  const img = document.getElementById(`doc-img-${id}`);
  const error = document.getElementById(`doc-error-${id}`);
  if (url) {
  if(link) link.href = url;
  if(img) img.src = url;
  } else {
  if(link) link.style.display = 'none';
  if(error) error.classList.remove('hidden');
  }
  };

  document.getElementById('profile-avatar').src = user.profileImageUrl || `https://placehold.co/128x128/EBF4FF/7F9CF5?text=${user.firstName?.charAt(0) || 'A'}&font=inter`;
  setText('profile-name', fullName);
  
  // ✅ Use the global code map to display the full category description
  const categoryDescription = CODE_TO_DESCRIPTION_MAP[user.category] || user.category || 'N/A';
  setText('profile-category', categoryDescription);
  
  setText('profile-email', user.email);
  setText('profile-contact', user.contact);
  setText('profile-address', user.address);
  setText('profile-sp-id', user.soloParentIdNumber);
  
  const statusBadge = document.getElementById('profile-status-badge');
  if (user.status === 'approved') {
  statusBadge.textContent = 'Approved';
  statusBadge.className = 'px-3 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800';
  approveBtn.style.display = 'none';
  rejectBtn.style.display = 'none';
  editBtn.style.display = 'flex';
  } else if (user.status === 'pending') {
  statusBadge.textContent = 'Pending';
  statusBadge.className = 'px-3 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800';
  approveBtn.style.display = 'flex';
  rejectBtn.style.display = 'flex';
  editBtn.style.display = 'none';
  } else {
  statusBadge.textContent = 'Rejected';
  statusBadge.className = 'px-3 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800';
  approveBtn.style.display = 'flex';
  rejectBtn.style.display = 'none';
  editBtn.style.display = 'none';
  }

  setText('detail-full-name', fullName);
  setText('detail-email', user.email);
  setText('detail-dob', user.dateOfBirth);
  setText('detail-age', user.age);
  setText('detail-sex', user.sex);
  setText('detail-pob', user.placeOfBirth);
  setText('detail-civil-status', user.civilStatus);
  setText('detail-ethnicity', user.ethnicity);
  setText('detail-religion', user.religion);
  setText('detail-created-at', user.createdAt ? user.createdAt.toDate().toLocaleDateString() : 'N/A');
  setText('detail-occupation', user.occupation);
  setText('detail-company', user.companyAgency);
  setText('detail-income', user.monthlyIncome);
  setText('detail-num-children', user.numberOfChildren);
  setText('detail-children-ages', user.childrenAges ? user.childrenAges.join(', ') : 'N/A');
  setText('detail-has-philhealth', user.hasPhilhealth ? 'Yes' : 'No');
  setText('detail-philhealth-id', user.philhealthIdNumber);

  setDoc('valid-id', user.proofIdUrl);
  setDoc('proof', user.proofSoloParentUrl);
  setDoc('philhealth', user.philhealthIdUrl);

  approveBtn.addEventListener('click', () => approveUser(userId));
  rejectBtn.addEventListener('click', () => rejectUser(userId));
  editBtn.addEventListener('click', () => console.log('Edit functionality is not yet implemented.'));
 
  feather.replace();
 } catch (error) {
  console.error("❌ Error fetching user profile:", error);
  breadcrumb.textContent = "Error: Could not load user profile.";
  actionsDiv.innerHTML = `<p class="text-sm text-red-500">${error.message}</p>`;
 }
}

// --------------------------------------------------------------------------
// ANNOUNCEMENTS PAGE LOGIC (`announcements.html`)
// --------------------------------------------------------------------------
function initAnnouncementsPage() {
 console.log("🚀 Initializing Announcements Page...");
 const annForm = document.getElementById('create-announcement-form');
 const annListEl = document.getElementById('announcement-list');
 
  async function loadAnnouncements() {
  if (!db) {
  annListEl.innerHTML = `<p class="text-sm text-red-500">Database connection error.</p>`;
  return;
  }
  annListEl.innerHTML = `<p class="text-center text-gray-500">Loading announcements...</p>`;
  try {
  const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
  annListEl.innerHTML = `<p class="text-center text-gray-500">No announcements found.</p>`;
  return;
  }
  annListEl.innerHTML = "";
  snapshot.forEach(doc => {
  const ann = doc.data();
  const annId = doc.id;
  const date = ann.createdAt.toDate();
  const formattedDate = date.toLocaleDateString(undefined, {
  month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
  });
  const imageHtml = ann.imageUrl ?
  `<img src="${ann.imageUrl}" class="w-full h-48 object-cover rounded-lg mt-4 mb-2">` :
  '';
  annListEl.innerHTML += `
  <div class="bg-white p-5 rounded-lg shadow-sm border border-gray-100 relative">
  <button data-id="${annId}" class="delete-ann-btn absolute top-4 right-4 text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-50" title="Delete Announcement">
  <i data-feather="trash-2" class="w-4 h-4 pointer-events-none"></i>
  </button>
 
  <h4 class="font-bold text-gray-800">${ann.title}</h4>
  <p class="text-xs text-gray-500 mt-1">Posted on ${formattedDate}</p>
 
  ${imageHtml}
 
  <p class="text-sm text-gray-700 mt-4 whitespace-pre-wrap">${ann.body}</p>
  </div>
  `;
  });
 
  addDynamicButtonListeners();
  feather.replace();
  } catch (error) {
  console.error("❌ Error loading announcements:", error);
  annListEl.innerHTML = `<p class="text-center text-red-500">Error loading announcements: ${error.message}</p>`;
  }
 }
 
  if (annForm) {
  annForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('ann-title').value;
  const body = document.getElementById('ann-body').value;
  const imageUrl = document.getElementById('ann-image').value;
  if (!title || !body) {
  console.error("Title and Message Body are required.");
  return;
  }
  try {
  const annData = {
  title: title,
  body: body,
  imageUrl: imageUrl || null,
  createdAt: Timestamp.now()
  };
  await addDoc(collection(db, "announcements"), annData);
  console.log("✅ Announcement published!");
  annForm.reset();
  loadAnnouncements();
  } catch (error) {
  console.error("❌ Error publishing announcement:", error);
  }
  });
 }
  async function deleteAnnouncement(annId) {
  try {
  await deleteDoc(doc(db, "announcements", annId));
  console.log("Announcement deleted.");
  loadAnnouncements();
  } catch (error) {
  console.error("❌ Error deleting announcement:", error);
  }
 }
  function addDynamicButtonListeners() {
  annListEl.querySelectorAll('.delete-ann-btn').forEach(btn => {
  btn.addEventListener('click', (e) => deleteAnnouncement(e.target.dataset.id));
  });
 }
  loadAnnouncements();
}

// --------------------------------------------------------------------------
// MAIN APP INITIALIZATION
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', function() {
 if (!db) {
  console.error("Firebase DB not available. Aborting script execution.");
  return;
 }
 // Run common functions on all pages
 handleSidebarHighlight();
 handleMobileSidebar();
 handleLogout();
 
 // Run page-specific logic
 if (isPage('dashboard.html')) {
  initDashboardPage();
 } else if (isPage('applications.html')) {
  initApplicationsPage();
 } else if (isPage('members.html')) {
  initMembersPage();
 } else if (isPage('categories.html')) {
  initCategoriesPage();
 } else if (isPage('events.html')) {
  initEventsPage();
 } else if (isPage('announcements.html')) {
  initAnnouncementsPage();
 } else if (isPage('profile.html')) {
  initProfilePage();
 } else if (isPage('index.html') || isPage('/') || window.location.pathname === '/') {
  handlePasswordToggle(); // For login page
 }
 
 // Finally, replace all Feather icons
 feather.replace();
});
