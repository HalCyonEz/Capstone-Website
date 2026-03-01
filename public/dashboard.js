import { db } from "./firebase-config.js";
import { initSidebar, initLogout, CODE_TO_DESCRIPTION_MAP } from "./utils.js";
import { collection, getDocs, query, where, orderBy, Timestamp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

// Initialize UI
initSidebar();
initLogout();

let allUsersData = [];
let donutChartInstance = null;
let predictiveChartInstance = null;
let categoryChartInstance = null;

// ==========================================
// 1. DATA FETCHING (COMBINED DATABASES)
// ==========================================
async function fetchAllUsers() {
    if (!db) {
        console.error("❌ Firebase 'db' is not initialized.");
        return;
    }
    try {
        allUsersData = []; 
        
        // Step 1: Get Pending & Rejected from Mobile App (users collection)
        const usersSnapshot = await getDocs(collection(db, "users"));
        usersSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.status === "pending" || data.status === "rejected") {
                allUsersData.push({ ...data, id: doc.id });
            }
        });

        // Step 2: Get ALL Official Records (online + offline) from solo_parent_records
        const recordsSnapshot = await getDocs(collection(db, "solo_parent_records"));
        recordsSnapshot.forEach(doc => {
            const data = doc.data();
            allUsersData.push({
                ...data,
                id: doc.id,
                status: data.status || "approved",
                createdAt: data.registrationDate || data.createdAt 
            });
        });
    } catch (error) {
        console.error("❌ Error fetching combined users:", error);
    }
}

async function fetchUpcomingEvents() {
    const eventsList = document.getElementById('upcoming-events-list');
    if (!eventsList || !db) return;

    try {
        const eventsQuery = query(collection(db, "events"), where("eventDate", ">=", Timestamp.now()), orderBy("eventDate", "asc"));
        const snapshot = await getDocs(eventsQuery);

        if (snapshot.empty) {
            eventsList.innerHTML = `<p class="text-sm text-gray-500">No upcoming events found.</p>`;
            return;
        }

        eventsList.innerHTML = "";
        const topEvents = snapshot.docs.slice(0, 3);
        
        topEvents.forEach(doc => {
            const event = doc.data();
            const eventDate = (event.eventDate && typeof event.eventDate.toDate === 'function') ? event.eventDate.toDate() : new Date();
            
            const eventHtml = `
            <div class="flex items-start border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                <div class="bg-blue-100 p-2 rounded-lg mr-3 h-10 w-10 flex items-center justify-center text-blue-600 font-bold text-xs flex-shrink-0">
                    ${eventDate.getDate()}
                </div>
                <div>
                    <h3 class="text-sm font-semibold text-gray-800 truncate w-48">${event.eventName || 'Event'}</h3>
                    <p class="text-xs text-gray-500">${eventDate.toLocaleDateString()} • ${event.eventLocation || 'Online'}</p>
                </div>
            </div>`;
            eventsList.innerHTML += eventHtml;
        });
    } catch (error) {
        eventsList.innerHTML = `<p class="text-sm text-red-500">Error loading events.</p>`;
    }
}

// ==========================================
// 2. CHART INITIALIZERS
// ==========================================
function initDonutChart() {
    const ctx = document.getElementById('donutChart');
    if(!ctx) return;
    donutChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: { labels: ['Approved', 'Pending', 'Rejected'], datasets: [{ data: [0, 0, 0], backgroundColor: ['#10B981', '#F59E0B', '#EF4444'], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { display: false } } }
    });
}

function initPredictiveChart() {
    const ctx = document.getElementById('predictiveChart');
    if (!ctx) return;
    predictiveChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: { 
            labels: [], 
            datasets: [{ 
                label: 'Expected ID Renewals', 
                data: [], 
                backgroundColor: ['#A78BFA', '#8B5CF6', '#7C3AED', '#6D28D9', '#5B21B6', '#4C1D95'], 
                borderRadius: 4, 
                barPercentage: 0.7 
            }] 
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
                legend: { display: false },
                tooltip: { callbacks: { label: function(context) { return context.raw + " Expected Renewals"; } } }
            }, 
            scales: { 
                y: { beginAtZero: true, grid: { color: '#f3f4f6' }, ticks: { precision: 0 } }, 
                x: { grid: { display: false } } 
            } 
        }
    });
}

function initCategoryChart() {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;
    categoryChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'pie',
        data: { labels: [], datasets: [{ data: [], backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6'], borderWidth: 1 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } } } }
    });
}

// ==========================================
// 3. DASHBOARD STATS UPDATERS
// ==========================================
function updateDashboardStats(filter) {
    let startDate, endDate;
    const now = new Date();
    
    if (filter === 'this_week') { 
        startDate = new Date(); startDate.setDate(startDate.getDate() - startDate.getDay()); startDate.setHours(0,0,0,0);
        endDate = new Date(startDate); endDate.setDate(startDate.getDate() + 6); endDate.setHours(23,59,59,999);
    } else if (filter === 'this_month') { 
        startDate = new Date(now.getFullYear(), now.getMonth(), 1); 
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0); 
    } else if (filter === 'this_year') { 
        startDate = new Date(now.getFullYear(), 0, 1); 
        endDate = new Date(now.getFullYear(), 11, 31); 
    } else if (filter === 'custom') {
        const startVal = document.getElementById('start-date')?.value;
        const endVal = document.getElementById('end-date')?.value;
        if (startVal && endVal) { startDate = new Date(startVal); endDate = new Date(endVal); } 
        else { startDate = new Date(0); endDate = new Date(); }
    } else {
        startDate = new Date(0); endDate = new Date();
    }
    
    let registered = 0, pending = 0, approved = 0, rejected = 0;
    
    const filteredUsers = allUsersData.filter(u => {
        let d = null;
        if (u.createdAt && typeof u.createdAt.toDate === 'function') d = u.createdAt.toDate();
        else if (u.createdAt) d = new Date(u.createdAt);
        return filter === 'all' || (d && d >= startDate && d <= endDate);
    });

    filteredUsers.forEach(u => {
        if (u.status === 'pending') pending++;
        else if (u.status === 'approved') approved++;
        else if (u.status === 'rejected') rejected++;
    });
    registered = filteredUsers.length;

    const elReg = document.getElementById('registered-count'); if(elReg) elReg.textContent = registered;
    const elPen = document.getElementById('pending-count'); if(elPen) elPen.textContent = pending;
    const elApp = document.getElementById('approved-count'); if(elApp) elApp.textContent = approved;

    if (donutChartInstance) {
        donutChartInstance.data.datasets[0].data = [approved, pending, rejected];
        donutChartInstance.update();
    }
    
    const pApproved = registered > 0 ? Math.round(approved/registered*100) : 0;
    const pPending = registered > 0 ? Math.round(pending/registered*100) : 0;
    const pRejected = registered > 0 ? Math.round(rejected/registered*100) : 0;

    const lblApp = document.getElementById('chart-label-approved'); if(lblApp) lblApp.textContent = `Approved (${pApproved}%)`;
    const lblPen = document.getElementById('chart-label-pending'); if(lblPen) lblPen.textContent = `Pending (${pPending}%)`;
    const lblRej = document.getElementById('chart-label-rejected'); if(lblRej) lblRej.textContent = `Rejected (${pRejected}%)`;

    const statusDescEl = document.getElementById('status-description');
    if (statusDescEl) statusDescEl.innerHTML = pending > 0 ? `You have <strong>${pending} pending applications</strong> waiting for review.` : `No pending applications. System processed <strong>${registered}</strong> records.`;

    updateRecentActivity(filteredUsers.slice(0, 5));
    updateCategoryChart(filteredUsers, filter);
    updateForecastWithRealData(); 
}

// 🎯 SMART CATEGORY PARSER
function updateCategoryChart(users, filterType) {
    if (!categoryChartInstance || !users) return;
    const totalUsers = users.length;
    const counts = {};

    users.forEach(user => {
        let rawCat = (user.category || "Unspecified").trim();
        let code = rawCat.split(/[\s-]/)[0].toLowerCase(); // Extracts 'a7' from 'a7 - Abandoned'
        
        let label = "Unspecified";
        if (CODE_TO_DESCRIPTION_MAP[code]) {
            label = CODE_TO_DESCRIPTION_MAP[code]; 
        } else if (CODE_TO_DESCRIPTION_MAP[rawCat]) {
            label = CODE_TO_DESCRIPTION_MAP[rawCat];
        } else {
            label = rawCat;
        }

        counts[label] = (counts[label] || 0) + 1;
    });

    const sortedLabels = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    const sortedData = sortedLabels.map(label => counts[label]);

    categoryChartInstance.data.labels = sortedLabels;
    categoryChartInstance.data.datasets[0].data = sortedData;
    categoryChartInstance.update();

    const descEl = document.getElementById('demographics-description');
    if (descEl) {
        if (totalUsers === 0) {
            descEl.textContent = "No data available for this time period.";
            return;
        }
        const textParts = sortedLabels.map(label => {
            const count = counts[label];
            const percentage = Math.round((count / totalUsers) * 100);
            const shortLabel = label.length > 25 ? label.substring(0, 25) + '...' : label;
            return `<strong>${percentage}% (${count})</strong> ${shortLabel}`;
        });

        let sentence = textParts.length > 0 ? textParts.slice(0, 3).join(', ') : "No categories found";
        descEl.innerHTML = `Top distributions: ${sentence}.`;
    }
}

// 🎯 RENEWAL WAVE ALGORITHM
function updateForecastWithRealData() {
    if (!allUsersData || !predictiveChartInstance) return;

    const today = new Date();
    let labels = [];
    let dataPoints = [];
    let monthCounts = {};
    let fullMonthNames = [];

    for (let i = 0; i < 6; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const shortMonth = d.toLocaleString('default', { month: 'short' });
        const fullMonth = d.toLocaleString('default', { month: 'long', year: 'numeric' });
        
        labels.push(i === 0 ? `${shortMonth} (Now)` : shortMonth);
        fullMonthNames.push(fullMonth);
        monthCounts[fullMonth] = 0;
    }

    allUsersData.forEach(user => {
        if (user.status === 'approved' || user.status === 'verified') {
            let regDate = null;
            if (user.registrationDate && typeof user.registrationDate.toDate === 'function') regDate = user.registrationDate.toDate();
            else if (user.registrationDate) regDate = new Date(user.registrationDate);
            else if (user.createdAt && typeof user.createdAt.toDate === 'function') regDate = user.createdAt.toDate();
            else if (user.createdAt) regDate = new Date(user.createdAt);

            if (regDate && !isNaN(regDate.getTime())) {
                const expirationDate = new Date(regDate.getFullYear() + 1, regDate.getMonth(), regDate.getDate());
                const expirationMonthKey = expirationDate.toLocaleString('default', { month: 'long', year: 'numeric' });
                
                if (monthCounts.hasOwnProperty(expirationMonthKey)) {
                    monthCounts[expirationMonthKey]++;
                }
            }
        }
    });

    fullMonthNames.forEach(month => {
        dataPoints.push(monthCounts[month]);
    });

    predictiveChartInstance.data.labels = labels;
    predictiveChartInstance.data.datasets[0].data = dataPoints;
    predictiveChartInstance.update();

    generateSmartAnalytics(fullMonthNames, dataPoints);
}

// 🎯 SIMPLIFIED TEXT GENERATOR
function generateSmartAnalytics(monthLabels, dataPoints) {
    const summaryEl = document.getElementById('predictive-summary-text');
    const forecastDescEl = document.getElementById('forecast-description');

    let maxRenewals = 0;
    let peakMonthIndex = 0;
    let totalRenewals = 0;

    for (let i = 0; i < dataPoints.length; i++) {
        totalRenewals += dataPoints[i];
        if (dataPoints[i] > maxRenewals) {
            maxRenewals = dataPoints[i];
            peakMonthIndex = i;
        }
    }

    if (summaryEl) {
        if (maxRenewals === 0) {
            summaryEl.innerHTML = `<strong class="block text-gray-800 mb-1">⚖️ Stable Workload</strong><p>No major ID renewals expected soon.</p>`;
        } else {
            const peakMonthShort = monthLabels[peakMonthIndex].split(' ')[0];
            summaryEl.innerHTML = `<strong class="block text-purple-800 mb-1">🌊 Renewal Wave</strong><p>Expect <strong>${maxRenewals} renewals</strong> in <strong>${peakMonthShort}</strong>.</p>`;
        }
    }

    if (forecastDescEl) {
        if (totalRenewals === 0) {
            forecastDescEl.innerHTML = `No ID renewals are scheduled for the next 6 months.`;
        } else {
            const peakMonthFull = monthLabels[peakMonthIndex];
            forecastDescEl.innerHTML = `<strong>Action Required:</strong> A large number of Solo Parent IDs will expire in <strong>${peakMonthFull}</strong>. Please ensure the MSWDO front desk is ready and has enough blank ID cards for printing.<br><br>Overall, you have <strong>${totalRenewals} expected renewals</strong> over the next 6 months.`;
        }
    }
}

function updateRecentActivity(users) {
    const tableBody = document.getElementById('recent-activity-table');
    if (!tableBody) return;
    tableBody.innerHTML = users.length === 0 ? `<tr><td colspan="4" class="px-6 py-4 text-center text-gray-500">No recent activity.</td></tr>` : "";
    
    users.forEach(user => {
        const name = `${user.firstName || ''} ${user.lastName || ''}`;
        let date = 'N/A';
        if (user.createdAt && typeof user.createdAt.toDate === 'function') date = user.createdAt.toDate().toLocaleDateString();
        else if (user.createdAt) date = new Date(user.createdAt).toLocaleDateString();

        const statusClass = user.status === 'approved' ? 'bg-green-100 text-green-800' : (user.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800');
        const statusText = user.status ? user.status.charAt(0).toUpperCase() + user.status.slice(1) : "Unknown";
        tableBody.innerHTML += `<tr><td class="px-6 py-4 text-sm font-medium text-gray-900">${name}</td><td class="px-6 py-4 text-sm text-gray-500">Application</td><td class="px-6 py-4"><span class="px-2 inline-flex text-xs font-semibold rounded-full ${statusClass}">${statusText}</span></td><td class="px-6 py-4 text-sm text-gray-500">${date}</td></tr>`;
    });
}

// ==========================================
// 4. PRESCRIPTIVE AI RECOMMENDATIONS
// ==========================================
async function runPrescriptiveAnalytics() {
    try {
        const q = query(collection(db, "solo_parent_records"), where("status", "==", "approved"));
        const snapshot = await getDocs(q);
        const ageStats = {}, offlineStats = {}, financeStats = {}, categoryStats = {};
        const today = new Date();

        snapshot.forEach((doc) => {
            const data = doc.data();
            const brgyRaw = data.barangay || "Unknown Barangay";
            const muniRaw = data.municipality || "Unknown Municipality";
            let specificLocation = (brgyRaw !== "Unknown Barangay" && muniRaw !== "Unknown Municipality") ? `${brgyRaw}, ${muniRaw}` : brgyRaw;

            const isApproved = data.status === "approved" || data.status === "verified";
            const isOffline = data.is_online === false;
            const income = data.monthlyIncome || "";
            const cat = data.category || "Unspecified";

            if (isApproved && data.dateOfBirth) {
                const dob = new Date(data.dateOfBirth);
                if (!isNaN(dob.getTime())) {
                    let age = today.getFullYear() - dob.getFullYear();
                    if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) age--;
                    if (!ageStats[specificLocation]) ageStats[specificLocation] = { youth: 0, senior: 0 };
                    if (age < 21) ageStats[specificLocation].youth++;
                    else if (age >= 60) ageStats[specificLocation].senior++;
                }
            }
            if (isOffline) offlineStats[specificLocation] = (offlineStats[specificLocation] || 0) + 1;
            if (income.includes("Below") && income.includes("5,000")) financeStats[specificLocation] = (financeStats[specificLocation] || 0) + 1;
            if (isApproved && cat !== "Unspecified") categoryStats[cat] = (categoryStats[cat] || 0) + 1;
        });

        // Age UI
        let maxAgeCount = 0, maxAgeType = null, targetAgeLocation = null;
        for (const [loc, stats] of Object.entries(ageStats)) {
            if (stats.youth > maxAgeCount) { maxAgeCount = stats.youth; maxAgeType = 'youth'; targetAgeLocation = loc; }
            if (stats.senior > maxAgeCount) { maxAgeCount = stats.senior; maxAgeType = 'senior'; targetAgeLocation = loc; }
        }
        const ageEl = document.getElementById('rx-age');
        if (ageEl) {
            if (maxAgeCount === 0) ageEl.innerHTML = `<span class="text-gray-500">No significant vulnerable age anomalies detected.</span>`;
            else if (maxAgeType === 'youth') ageEl.innerHTML = `<strong class="text-blue-800">VULNERABLE AGE (YOUTH):</strong> Barangay <strong>${targetAgeLocation}</strong> has the highest concentration of young solo parents (${maxAgeCount} under age 21).<br><br><strong>Recommendation:</strong> Prioritize allocating educational assistance here.`;
            else ageEl.innerHTML = `<strong class="text-blue-800">VULNERABLE AGE (SENIOR):</strong> Barangay <strong>${targetAgeLocation}</strong> has the highest concentration of senior citizen solo parents (${maxAgeCount} age 60+).<br><br><strong>Recommendation:</strong> Prioritize this area for targeted medical assistance and senior health programs.`;
        }

        // Awareness UI
        let maxOfflineCount = 0, targetOfflineLocation = null;
        for (const [loc, count] of Object.entries(offlineStats)) {
            if (count > maxOfflineCount) { maxOfflineCount = count; targetOfflineLocation = loc; }
        }
        const awarenessEl = document.getElementById('rx-awareness');
        if (awarenessEl) {
            if (maxOfflineCount === 0) awarenessEl.innerHTML = `<span class="text-gray-500">All registered solo parents are currently online.</span>`;
            else awarenessEl.innerHTML = `<strong class="text-orange-800">AWARENESS CAMPAIGN:</strong> Barangay <strong>${targetOfflineLocation}</strong> has the highest number of offline records (${maxOfflineCount} solo parents).<br><br><strong>Recommendation:</strong> Conduct an information drive here to promote the mobile app.`;
        }

        // Finance UI
        let maxFinanceCount = 0, targetFinanceLocation = null;
        for (const [loc, count] of Object.entries(financeStats)) {
            if (count > maxFinanceCount) { maxFinanceCount = count; targetFinanceLocation = loc; }
        }
        const financeEl = document.getElementById('rx-finance');
        if (financeEl) {
            if (maxFinanceCount === 0) financeEl.innerHTML = `<span class="text-gray-500">No extreme low-income clusters detected.</span>`;
            else financeEl.innerHTML = `<strong class="text-green-800">FINANCIAL AID PRIORITY:</strong> Barangay <strong>${targetFinanceLocation}</strong> has the highest concentration of extreme low-income earners (${maxFinanceCount} earning below ₱5,000/month).<br><br><strong>Recommendation:</strong> Strictly prioritize this area for the next LGU food pack distribution.`;
        }

        // Social Program UI
        let maxCatCount = 0, topCategoryCode = null;
        for (const [cat, count] of Object.entries(categoryStats)) {
            if (count > maxCatCount) { maxCatCount = count; topCategoryCode = cat; }
        }
        const socialEl = document.getElementById('rx-social');
        if (socialEl) {
            if (maxCatCount === 0) socialEl.innerHTML = `<span class="text-gray-500">Not enough categorized data available.</span>`;
            else {
                let code = topCategoryCode.split(/[\s-]/)[0].toLowerCase();
                let catName = CODE_TO_DESCRIPTION_MAP[code] || topCategoryCode;
                let specificRec = "organize general solo parent seminars and community support networks.";
                
                if (code === 'a2') specificRec = "organize grief counseling, psychosocial support groups, and livelihood starter kits.";
                else if (code === 'a7') specificRec = "coordinate with PAO to offer free legal consultation regarding child support.";
                else if (code === 'a1' || code === 'a3') specificRec = "provide highly confidential psychological trauma counseling.";
                else if (code === 'c') specificRec = "focus on maternal/paternal health education and early childhood development seminars.";

                socialEl.innerHTML = `<strong class="text-purple-800">TARGETED SOCIAL PROGRAM:</strong> The most frequent solo parent category in the LGU is <strong>${catName}</strong> (${maxCatCount} registered).<br><br><strong>Recommendation:</strong> The MSWDO should ${specificRec}`;
            }
        }
    } catch (error) {
        console.error("Prescriptive Analytics Error:", error);
    }
}

// ==========================================
// 5. STRATEGIC FORECASTING ENGINE
// ==========================================
async function runStrategicForecasting() {
    try {
        const q = query(collection(db, "solo_parent_records"), where("status", "==", "approved"));
        const snapshot = await getDocs(q);
        const today = new Date();
        const currentYear = today.getFullYear();
        
        let turning60In1Year = 0, turning60In3Years = 0, turning60In5Years = 0, alreadySenior = 0;
        const recordsWithDates = []; 

        snapshot.forEach(doc => {
            const data = doc.data();
            const regDateRaw = data.registrationDate || data.createdAt;
            if (regDateRaw) recordsWithDates.push(data);

            // --- 1. DEMOGRAPHIC SHIFT (AGING ALGORITHM) ---
            if (data.dateOfBirth) {
                const dob = new Date(data.dateOfBirth);
                if (!isNaN(dob.getTime())) {
                    let age = currentYear - dob.getFullYear();
                    if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) age--;
                    if (age >= 60) alreadySenior++;
                    else if (age + 1 >= 60) turning60In1Year++;
                    else if (age + 3 >= 60 && age + 1 < 60) turning60In3Years++;
                    else if (age + 5 >= 60 && age + 3 < 60) turning60In5Years++;
                }
            }
        });

        // INJECT AGING UI
        const agingEl = document.getElementById('forecast-aging-content');
        if (agingEl) {
            const cumulative3 = turning60In1Year + turning60In3Years;
            const cumulative5 = cumulative3 + turning60In5Years;
            agingEl.innerHTML = `
                <div class="flex justify-between items-center bg-white p-2.5 rounded border border-gray-100 shadow-sm mb-2"><span class="text-sm font-medium text-gray-600">Next 1 Year (By ${currentYear + 1}):</span><span class="text-sm font-bold text-red-600">+${turning60In1Year} new seniors</span></div>
                <div class="flex justify-between items-center bg-white p-2.5 rounded border border-gray-100 shadow-sm mb-2"><span class="text-sm font-medium text-gray-600">Next 3 Years (By ${currentYear + 3}):</span><span class="text-sm font-bold text-orange-500">+${cumulative3} new seniors</span></div>
                <div class="flex justify-between items-center bg-white p-2.5 rounded border border-gray-100 shadow-sm mb-2"><span class="text-sm font-medium text-gray-600">Next 5 Years (By ${currentYear + 5}):</span><span class="text-sm font-bold text-yellow-600">+${cumulative5} new seniors</span></div>
                <p class="text-xs text-gray-500 mt-2 italic">* Note: There are currently ${alreadySenior} seniors in the database.</p>
            `;
        }

        // --- 2. FINANCIAL AID FORECAST (SIMPLIFIED) ---
        const economicEl = document.getElementById('forecast-economic-content');
        if (economicEl) {
            if (recordsWithDates.length < 2) {
                economicEl.innerHTML = `<p class="text-sm text-gray-500 p-2 border border-dashed rounded">Not enough members registered yet to make a forecast.</p>`;
            } else {
                // Sort records chronologically (oldest to newest)
                recordsWithDates.sort((a, b) => {
                    const dateAObj = a.registrationDate || a.createdAt;
                    const dateBObj = b.registrationDate || b.createdAt;
                    const dateA = typeof dateAObj.toDate === 'function' ? dateAObj.toDate() : new Date(dateAObj);
                    const dateB = typeof dateBObj.toDate === 'function' ? dateBObj.toDate() : new Date(dateBObj);
                    return dateA - dateB;
                });

                // Split into Older vs Newer members
                const midPoint = Math.floor(recordsWithDates.length / 2);
                const pastHalf = recordsWithDates.slice(0, midPoint);
                const recentHalf = recordsWithDates.slice(midPoint);

                // Count how many earn below 5k
                const countBelow5k = (arr) => arr.filter(d => d.monthlyIncome && d.monthlyIncome.includes("Below") && d.monthlyIncome.includes("5,000")).length;
                const pastBelow5kCount = countBelow5k(pastHalf);
                const recentBelow5kCount = countBelow5k(recentHalf);

                // Calculate the difference
                const pastPct = pastHalf.length > 0 ? (pastBelow5kCount / pastHalf.length) : 0;
                const recentPct = recentHalf.length > 0 ? (recentBelow5kCount / recentHalf.length) : 0;
                const diff = recentPct - pastPct;

                // Create the simple alert box
                let alertBox = "";
                if (diff > 0) {
                    alertBox = `
                        <div class="bg-red-50 border-l-4 border-red-500 p-3 rounded mt-2 shadow-sm">
                            <p class="text-sm text-red-800 font-bold mb-1"><i data-feather="alert-triangle" class="inline w-4 h-4 mr-1"></i> Warning: Hardship is Rising</p>
                            <p class="text-xs text-red-700 leading-relaxed">More newly registered solo parents are earning below ₱5,000 compared to older members.<br><br><strong>Action:</strong> You should request a higher budget for food packs next quarter.</p>
                        </div>`;
                } else if (diff < 0) {
                    alertBox = `
                        <div class="bg-green-50 border-l-4 border-green-500 p-3 rounded mt-2 shadow-sm">
                            <p class="text-sm text-green-800 font-bold mb-1"><i data-feather="check-circle" class="inline w-4 h-4 mr-1"></i> Good News: Hardship is Dropping</p>
                            <p class="text-xs text-green-700 leading-relaxed">Fewer newly registered solo parents are earning below ₱5,000 compared to older members.<br><br><strong>Action:</strong> You do not need to request extra emergency food packs right now.</p>
                        </div>`;
                } else {
                    alertBox = `
                        <div class="bg-gray-50 border-l-4 border-gray-500 p-3 rounded mt-2 shadow-sm">
                            <p class="text-sm text-gray-800 font-bold mb-1"><i data-feather="minus" class="inline w-4 h-4 mr-1"></i> Needs are Stable</p>
                            <p class="text-xs text-gray-600 leading-relaxed">The number of low-income applicants remains exactly the same over time.<br><br><strong>Action:</strong> Maintain your current budget for assistance programs.</p>
                        </div>`;
                }

                // Inject UI
                economicEl.innerHTML = `
                    <div class="grid grid-cols-2 gap-3 mb-2">
                        <div class="bg-white p-3 rounded border border-gray-200 shadow-sm text-center">
                            <p class="text-[11px] text-gray-500 uppercase font-bold mb-1">Older Members</p>
                            <p class="text-xl font-bold text-gray-800">${pastBelow5kCount} <span class="text-xs font-normal text-gray-400">out of ${pastHalf.length}</span></p>
                            <p class="text-[10px] text-gray-500 mt-1 leading-tight">earn below ₱5,000</p>
                        </div>
                        <div class="bg-white p-3 rounded border border-blue-200 bg-blue-50 shadow-sm text-center">
                            <p class="text-[11px] text-blue-700 uppercase font-bold mb-1">Newer Members</p>
                            <p class="text-xl font-bold text-blue-900">${recentBelow5kCount} <span class="text-xs font-normal text-blue-400">out of ${recentHalf.length}</span></p>
                            <p class="text-[10px] text-blue-600 mt-1 leading-tight">earn below ₱5,000</p>
                        </div>
                    </div>
                    ${alertBox}
                `;
            }
        }
    } catch (error) { 
        console.error("Strategic Forecasting Error:", error); 
    }
}

// ==========================================
// 🚀 INITIALIZATION TRIGGER
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    try { initDonutChart(); } catch(e) {}
    try { initPredictiveChart(); } catch(e) {}
    try { initCategoryChart(); } catch(e) {}
    
    fetchUpcomingEvents().catch(e => console.error(e));

    fetchAllUsers().then(() => {
        try { updateDashboardStats('this_month'); } catch(e) { console.error(e); }
    }).catch(e => console.error(e));

    setTimeout(() => {
        if (typeof runPrescriptiveAnalytics === 'function') runPrescriptiveAnalytics();
        if (typeof runStrategicForecasting === 'function') runStrategicForecasting(); 
    }, 2000); 

    try { feather.replace(); } catch(e){}

    const dateSelect = document.getElementById('date-range-select');
    const customRangeDiv = document.getElementById('custom-date-range');
    if(dateSelect && customRangeDiv) {
        dateSelect.addEventListener('change', function() {
            if (this.value === 'custom') { customRangeDiv.classList.remove('hidden'); customRangeDiv.classList.add('flex'); } 
            else { customRangeDiv.classList.add('hidden'); customRangeDiv.classList.remove('flex'); updateDashboardStats(this.value); }
        });
    }
    document.getElementById('apply-custom-date')?.addEventListener('click', () => updateDashboardStats('custom'));
});

// ==========================================
// 🖨️ GUARANTEED PRINT FIX FOR TAILWIND
// ==========================================
window.printDashboard = function() {
    const body = document.body;
    const mainContent = document.querySelector('.flex-1'); // Grabs your main scrollable wrapper
    
    // 1. Temporarily REMOVE the Tailwind locks
    body.classList.remove('h-screen', 'overflow-hidden', 'bg-gray-50');
    body.classList.add('h-auto', 'overflow-visible', 'bg-white');
    
    if (mainContent) {
        mainContent.classList.remove('overflow-auto');
        mainContent.classList.add('overflow-visible');
    }

    // 2. Wait exactly 200 milliseconds for the browser to "expand" the page, then Print
    setTimeout(() => {
        window.print();
        
        // 3. Put the locks BACK immediately after the print dialog closes so your screen returns to normal
        body.classList.add('h-screen', 'overflow-hidden', 'bg-gray-50');
        body.classList.remove('h-auto', 'overflow-visible', 'bg-white');
        
        if (mainContent) {
            mainContent.classList.add('overflow-auto');
            mainContent.classList.remove('overflow-visible');
        }
        
        // Optional: Force charts to resize back to the screen perfectly
        if (typeof Chart !== 'undefined') {
            for (let id in Chart.instances) {
                Chart.instances[id].resize();
            }
        }
    }, 200);
};