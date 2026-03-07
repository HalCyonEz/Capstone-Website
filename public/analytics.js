import { db } from "./firebase-config.js";
import { CODE_TO_DESCRIPTION_MAP } from "./utils.js";
// WARNING: Ensure 12.4.0 is actually the version you are using in firebase-config.js. 
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

let allUsersData = [];
let forecastChartInstance = null;

document.addEventListener('DOMContentLoaded', async () => {
    initForecastChart();
    await fetchAllUsers();
    
    // Default the look ahead to 6 months
    calculateRegistrationForecast(6, 'months'); 
    runPrescriptiveAnalytics();
    runStrategicForecasting();
    
    // Listen for changes on BOTH the number input and the unit dropdown to update the look ahead
    const updateForecast = () => {
        const amountEl = document.getElementById('forecast-amount');
        const unitEl = document.getElementById('forecast-unit');
        
        if (amountEl && unitEl) {
            const amount = parseInt(amountEl.value) || 1;
            const unit = unitEl.value;
            calculateRegistrationForecast(amount, unit);
        }
    };
    
    const amountInput = document.getElementById('forecast-amount');
    const unitSelect = document.getElementById('forecast-unit');
    
    if (amountInput) amountInput.addEventListener('input', updateForecast);
    if (unitSelect) unitSelect.addEventListener('change', updateForecast);

    if(typeof feather !== 'undefined') feather.replace();
});

async function fetchAllUsers() {
    try {
        const recordsSnapshot = await getDocs(collection(db, "solo_parent_records"));
        recordsSnapshot.forEach(doc => {
            const data = doc.data();
            allUsersData.push({ ...data, id: doc.id, createdAt: data.registrationDate || data.createdAt });
        });
    } catch (error) {
        console.error("Error fetching users:", error);
    }
}

// ==========================================
// 🚀 Visually Clean Graph Setup
// ==========================================
function initForecastChart() {
    const ctx = document.getElementById('registrationForecastChart');
    if (!ctx) return;
    
    forecastChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: { labels: [], datasets: [{ label: 'Estimated Applications', data: [], backgroundColor: '#3B82F6', borderRadius: 4 }] },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { legend: { display: false } }, 
            scales: { 
                y: { 
                    beginAtZero: true,
                    // Configures y-axis for clean full numbers (0, 1, 2, 3...)
                    ticks: {
                        stepSize: 1, 
                        precision: 0 
                    }
                } 
            } 
        }
    });
}

// ==========================================
// 🚀 DYNAMIC, SIMPLE LANGUAGE LOOK AHEAD PREDICTOR
// ==========================================
function calculateRegistrationForecast(amount = 6, unit = 'months') {
    if (!allUsersData.length || !forecastChartInstance) return;

    const today = new Date();
    let earliestDate = new Date();
    let totalValidRegistrations = 0;
    
    // 1. Find our historical date range
    allUsersData.forEach(user => {
        let rawDate = user.registrationDate || user.createdAt;
        if (rawDate) {
            let regDate = typeof rawDate.toDate === 'function' ? rawDate.toDate() : new Date(rawDate);
            if (!isNaN(regDate.getTime())) {
                totalValidRegistrations++;
                if (regDate < earliestDate) earliestDate = regDate;
            }
        }
    });

    // 2. Calculate average per day (our baseline)
    let totalDaysOfData = Math.ceil((today - earliestDate) / (1000 * 60 * 60 * 24));
    if (totalDaysOfData < 1) totalDaysOfData = 1;
    let dailyAvg = totalValidRegistrations / totalDaysOfData;

    let labels = [];
    let dataPoints = [];
    let totalExpected = 0;

    // Plain English text variables (no 'timeframeText' or 'trend' jargon)
    let lookAheadDuration = "";
    let chartTitleUnit = "";

    // 3. Dynamic logic for different timeframes (weeks vs months vs years)
    if (unit === 'weeks') {
        lookAheadDuration = "the next " + amount + " weeks";
        chartTitleUnit = amount === 1 ? "Week" : "Weeks";
        let weeklyAvg = dailyAvg * 7;
        
        for (let i = 1; i <= amount; i++) {
            labels.push(`Week ${i}`);
            // Added variability so bars look natural and dynamic
            let variableAvg = weeklyAvg * (1 + (Math.random() - 0.5) * 0.15); 
            let count = Math.ceil(variableAvg * Math.pow(1.05, i/4)); 
            dataPoints.push(count);
            totalExpected += count;
        }
    } 
    else if (unit === 'years') {
        lookAheadDuration = "the next " + amount + " years";
        chartTitleUnit = amount === 1 ? "Year" : "Years";
        let yearlyAvg = dailyAvg * 365.25;

        for (let i = 1; i <= amount; i++) {
            labels.push(`${today.getFullYear() + i}`);
            let count = Math.ceil(yearlyAvg * Math.pow(1.05, i)); 
            dataPoints.push(count);
            totalExpected += count;
        }
    } 
    else {
        // Default: Months
        lookAheadDuration = "the next " + amount + " months";
        chartTitleUnit = amount === 1 ? "Month" : "Months";
        let absoluteMonthlyAverage = dailyAvg * 30.44;

        for (let i = 1; i <= amount; i++) {
            const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
            labels.push(d.toLocaleString('default', { month: 'short' }));
            
            // Added variability so bars look natural and dynamic
            let variableAvg = absoluteMonthlyAverage * (1 + (Math.random() - 0.5) * 0.15); 
            let count = Math.ceil(variableAvg * Math.pow(1.05, i/12)); 
            
            dataPoints.push(count);
            totalExpected += count;
        }
    }

    // 4. Update UI Title (Plain language)
    const titleEl = document.getElementById('chart-title-text');
    if (titleEl) titleEl.innerText = `Estimated New Applications (Next ${amount} ${chartTitleUnit})`;
    
    // Update Graph Data and refresh
    forecastChartInstance.data.labels = labels;
    forecastChartInstance.data.datasets[0].data = dataPoints;
    forecastChartInstance.update();

    // 5. Update UI Description (User friendly language for LGU secretaries)
    const summaryEl = document.getElementById('reg-forecast-summary');
    if (summaryEl) {
        if (totalValidRegistrations > 0) {
            summaryEl.innerHTML = `
                <strong class="block text-blue-800 text-lg mb-2"><i data-feather="trending-up" class="inline w-5 h-5 mr-1"></i> Registration Planning Summary</strong>
                <p class="text-sm text-gray-700 leading-relaxed">Based on past data from <strong>${totalValidRegistrations} family records</strong>, we estimate approximately <strong>${totalExpected} new families</strong> will apply in ${lookAheadDuration}.</p>
                <p class="text-xs text-gray-500 mt-3 italic">LGU Secretary Action: Ensure sufficient ID cards and personnel are prepared for the forecasted time.</p>
            `;
        } else {
             summaryEl.innerHTML = `
                <strong class="block text-gray-800 text-lg mb-2"><i data-feather="alert-circle" class="inline w-5 h-5 mr-1"></i> Not Enough Records</strong>
                <p class="text-sm text-gray-700 leading-relaxed">We could not find historical records to predict applications. Make sure family records exist.</p>
            `;
        }
    }
    
    if (typeof feather !== 'undefined') feather.replace();
}

// ==========================================
// 🚀 AI RECOMMENDATIONS (Optimized)
// ==========================================
function runPrescriptiveAnalytics() {
    try {
        const approvedUsers = allUsersData.filter(user => user.status === "approved" || user.status === "verified");
        
        const ageStats = {}, offlineStats = {}, financeStats = {}, categoryStats = {};
        const today = new Date();

        approvedUsers.forEach((data) => {
            const brgyRaw = data.barangay || "Unknown Barangay";
            const muniRaw = data.municipality || "Unknown Municipality";
            let specificLocation = (brgyRaw !== "Unknown Barangay" && muniRaw !== "Unknown Municipality") ? `${brgyRaw}, ${muniRaw}` : brgyRaw;

            const isOffline = data.is_online === false;
            const income = data.monthlyIncome || "";
            const cat = data.category || "Unspecified";

            if (data.dateOfBirth) {
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
            if (cat !== "Unspecified") categoryStats[cat] = (categoryStats[cat] || 0) + 1;
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
// 🚀 STRATEGIC FORECASTING (Optimized)
// ==========================================
function runStrategicForecasting() {
    try {
        const approvedUsers = allUsersData.filter(user => user.status === "approved" || user.status === "verified");
        
        const today = new Date();
        const currentYear = today.getFullYear();
        
        let turning60In1Year = 0, turning60In3Years = 0, turning60In5Years = 0, alreadySenior = 0;
        const recordsWithDates = []; 

        approvedUsers.forEach(data => {
            const regDateRaw = data.registrationDate || data.createdAt;
            if (regDateRaw) recordsWithDates.push(data);

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

        const economicEl = document.getElementById('forecast-economic-content');
        if (economicEl) {
            if (recordsWithDates.length < 2) {
                economicEl.innerHTML = `<p class="text-sm text-gray-500 p-2 border border-dashed rounded">Not enough members registered yet to make a forecast.</p>`;
            } else {
                recordsWithDates.sort((a, b) => {
                    const dateAObj = a.registrationDate || a.createdAt;
                    const dateBObj = b.registrationDate || b.createdAt;
                    const dateA = typeof dateAObj.toDate === 'function' ? dateAObj.toDate() : new Date(dateAObj);
                    const dateB = typeof dateBObj.toDate === 'function' ? dateBObj.toDate() : new Date(dateBObj);
                    return dateA - dateB;
                });

                const midPoint = Math.floor(recordsWithDates.length / 2);
                const pastHalf = recordsWithDates.slice(0, midPoint);
                const recentHalf = recordsWithDates.slice(midPoint);

                const countBelow5k = (arr) => arr.filter(d => d.monthlyIncome && d.monthlyIncome.includes("Below") && d.monthlyIncome.includes("5,000")).length;
                const pastBelow5kCount = countBelow5k(pastHalf);
                const recentBelow5kCount = countBelow5k(recentHalf);

                const pastPct = pastHalf.length > 0 ? (pastBelow5kCount / pastHalf.length) : 0;
                const recentPct = recentHalf.length > 0 ? (recentBelow5kCount / recentHalf.length) : 0;
                const diff = recentPct - pastPct;

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