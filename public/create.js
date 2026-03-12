import { db } from "./firebase-config.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

console.log("🎯 create.js loaded - Dynamic Dropdowns Active");

// 1. Translated Kotlin Map to JS Object
const municipalityBarangayMap = {
    "Atok": ["Abiang", "Caliking", "Cattubo", "Naguey", "Paoay", "Pasdong", "Poblacion", "Topdac"],
    "Baguio": [
        "A. Bonifacio-Caguioa-Rimando (ABCR)", "Abanao-Zandueta-Kayong-Chugum-Otek (AZKCO)", "Alfonso Tabora", "Ambiong",
        "Andres Bonifacio (Lower Bokawkan)", "Apugan-Loakan", "Asin Road", "Atok Trail", "Aurora Hill Proper (Malvar-Sgt. Floresca)",
        "Aurora Hill, North Central", "Aurora Hill, South Central", "Bagong Lipunan (Market Area)", "Bakakeng Central",
        "Bakakeng North", "Bal-Marcoville (Marcoville)", "Balsigan", "Bayan Park East", "Bayan Park Village", "Bayan Park West",
        "BGH Compound", "Brookside", "Brookspoint", "Cabinet Hill-Teacher’s Camp", "Camdas Subdivision", "Camp 7", "Camp 8",
        "Camp Allen", "Campo Filipino", "City Camp Central", "City Camp Proper", "Country Club Village", "Cresencia Village",
        "Dagsian, Lower", "Dagsian, Upper", "Department of Public Services (DPS) Compound", "Dizon Subdivision",
        "Dominican Hill-Mirador", "Dontogan", "Engineers' Hill", "Fairview Village", "Ferdinand (Happy Homes-Campo Sioco)",
        "Fort del Pilar", "Gabriela Silang", "General Emilio F. Aguinaldo (Lower QM)", "General Luna, Lower", "General Luna, Upper",
        "Gibraltar", "Greenwater Village", "Guisad Central", "Guisad Sorong", "Happy Hollow", "Happy Homes (Happy Homes-Lucban)",
        "Harrison-Claudio Carantes", "Hillside", "Holy Ghost Extension", "Holy Ghost Proper", "Honeymoon (Honeymoon-Holy Ghost)",
        "Imelda R. Marcos (La Salle)", "Imelda Village", "Irisan", "Kabayanihan", "Kagitingan", "Kayang Extension", "Kayang-Hilltop",
        "Kias", "Legarda-Burnham-Kisad", "Liwanag-Loakan", "Loakan Proper", "Lopez Jaena", "Lourdes Subdivision Extension",
        "Lourdes Subdivision, Lower", "Lourdes Subdivision, Proper", "Lualhati", "Lucnab", "Magsaysay Private Road",
        "Magsaysay, Lower", "Magsaysay, Upper", "Malcolm Square-Perfecto (Jose Abad Santos)", "Manuel A. Roxas",
        "Market Subdivision, Upper", "Middle Quezon Hill Subdivision", "Military Cut-off", "Mines View Park", "Modern Site, East",
        "Modern Site, West", "MRR-Queen Of Peace", "New Lucban", "Outlook Drive", "Pacdal", "Padre Burgos", "Padre Zamora",
        "Palma-Urbano (Cariño-Palma)", "Phil-Am", "Pinget", "Pinsao Pilot Project", "Pinsao Proper", "Pucsusan", "Puliwes",
        "Quezon Hill Proper", "Quezon Hill, Upper", "Quirino Hill, East", "Quirino Hill, Lower", "Quirino Hill, Middle",
        "Quirino Hill, West", "Quirino-Magsaysay, Upper (Upper QM)", "Rizal Monument Area", "Rock Quarry, Lower",
        "Rock Quarry, Middle", "Rock Quarry, Upper", "Saint Joseph Village", "Salud Mitra", "San Antonio Village",
        "San Luis Village", "San Roque Village", "San Vicente", "Sanitary Camp, North", "Sanitary Camp, South",
        "Santa Escolastica", "Santo Rosario", "Santo Tomas Proper", "Santo Tomas School Area", "Scout Barrio",
        "Session Road Area", "Slaughter House Area (Santo Niño Slaughter)", "SLU-SVP Housing Village", "South Drive",
        "Teodora Alonzo", "Trancoville", "Victoria Village"
    ],
    "Bakun": ["Ampusongan", "Bagu", "Dalipey", "Gambang", "Kayapa", "Poblacion", "Sinacbat"],
    "Bokod": ["Ambuclao", "Bila", "Bobok-Bisal", "Daclan", "Ekip", "Karao", "Nawal", "Pito", "Poblacion", "Tikey"],
    "Buguias": ["Abatan", "Amgaleyguey", "Amlimay", "Baculongan Norte", "Baculongan Sur", "Bangao", "Buyacaoan", "Calamagan", "Catlubong", "Lengaoan", "Loo", "Natubleng", "Poblacion", "Sebang"],
    "Itogon": ["Ampucao", "Dalupirip", "Gumatdang", "Loacan", "Poblacion", "Tinongdan", "Tuding", "Ucab", "Virac"],
    "Kabayan": ["Adaoay", "Anchukey", "Ballay", "Bashoy", "Batan", "Duacan", "Eddet", "Gusaran", "Kabayan Barrio", "Lusod", "Pacso", "Poblacion", "Tawangan"],
    "Kapangan": ["Balakbak", "Beleng-Belis", "Boklaoan", "Cayapes", "Cuba", "Datakan", "Gadang", "Gasweling", "Labueg", "Paykek", "Poblacion Central", "Pongayan", "Pudong", "Sagubo", "Taba-ao"],
    "Kibungan": ["Badeo", "Lubo", "Madaymen", "Palina", "Poblacion", "Sagpat", "Tacadang"],
    "La Trinidad": ["Alapang", "Alno", "Ambiong", "Bahong", "Balili", "Beckel", "Betag", "Bineng", "Cruz", "Lubas", "Pico", "Poblacion", "Puguis", "Shilan", "Tawang", "Wangal"],
    "Mankayan": ["Balili", "Bedbed", "Bulalacao", "Cabiten", "Colalo", "Guinaoang", "Paco", "Palasaan", "Poblacion", "Sapid", "Suyoc", "Tabio", "Taneg"],
    "Sablan": ["Bagong", "Balluay", "Banangan", "Banengbeng", "Bayabas", "Kamog", "Pappa", "Poblacion"],
    "Tuba": ["Ansagan", "Camp 3", "Camp 4", "Camp One", "Nangalisan", "Poblacion", "San Pascual", "Tabaan Norte", "Tabaan Sur", "Tadiangan", "Taloy Norte", "Taloy Sur", "Twin Peaks"],
    "Tublay": ["Ambassador", "Ambongdolan", "Ba-ayan", "Basil", "Caponga", "Daclan", "Tublay Central", "Tuel"]
};

// 2. Initialize the Municipality Dropdown on Page Load
document.addEventListener('DOMContentLoaded', () => {
    const munSelect = document.getElementById('create-municipality');
    // Clear existing options just in case
    munSelect.innerHTML = '<option value="" disabled selected>Select municipality...</option>';
    
    // Sort keys alphabetically
    Object.keys(municipalityBarangayMap).sort().forEach(mun => {
        const option = document.createElement('option');
        option.value = mun;
        option.textContent = mun;
        munSelect.appendChild(option);
    });
});

// 3. Dynamic Barangay Population bound to the window
window.populateBarangays = function() {
    const munSelect = document.getElementById('create-municipality');
    const brgySelect = document.getElementById('create-barangay');
    const selectedMun = munSelect.value;

    brgySelect.innerHTML = '<option value="" disabled selected>Select barangay...</option>';
    
    if (selectedMun && municipalityBarangayMap[selectedMun]) {
        brgySelect.disabled = false;
        brgySelect.classList.remove('text-gray-400', 'bg-gray-50');
        brgySelect.classList.add('text-gray-700', 'bg-white');

        municipalityBarangayMap[selectedMun].forEach(brgy => {
            const option = document.createElement('option');
            option.value = brgy;
            option.textContent = brgy;
            brgySelect.appendChild(option);
        });
    } else {
        brgySelect.disabled = true;
        brgySelect.classList.add('text-gray-400', 'bg-gray-50');
        brgySelect.classList.remove('text-gray-700', 'bg-white');
    }
};

window.createMemberRecord = async function() {
    // 4. Updated Validation to include dropdowns
    const fname = document.getElementById('create-fname').value.trim();
    const lname = document.getElementById('create-lname').value.trim();
    const category = document.getElementById('create-category').value;
    const sex = document.getElementById('create-sex').value;
    const civil = document.getElementById('create-civil').value;
    const religion = document.getElementById('create-religion').value;
    const municipality = document.getElementById('create-municipality').value;
    const barangay = document.getElementById('create-barangay').value;
    const income = document.getElementById('create-income').value;

    if (!fname || !lname || !category || !sex || !civil || !religion || !municipality || !barangay || !income) {
        alert("Please fill out all required fields marked with a red asterisk (*).");
        return;
    }

    const btn = document.getElementById('btn-create-record');
    btn.innerHTML = '<i data-feather="loader" class="animate-spin w-4 h-4 mr-2"></i> Saving...';
    btn.disabled = true;
    if (typeof feather !== 'undefined') feather.replace();

    try {
        const year = new Date().getFullYear();
        const randomString = Math.random().toString(36).substring(2, 6).toUpperCase();
        const customId = `SP-${year}-${randomString}`;

        const rawChildrenAges = document.getElementById('create-children-ages').value.trim();
        const childrenAgesArray = rawChildrenAges 
            ? rawChildrenAges.split(',').map(age => age.trim()).filter(age => age !== "") 
            : [];

        const newRecordData = {
            soloParentIdNumber: customId,
            firstName: fname,
            lastName: lname,
            contact: document.getElementById('create-contact').value.trim(),
            email: document.getElementById('create-email').value.trim(),
            dateOfBirth: document.getElementById('create-dob').value.trim(),
            age: document.getElementById('create-age').value.trim(),
            category: category,
            sex: sex,
            civilStatus: civil,
            religion: religion,
            municipality: municipality,
            barangay: barangay,
            occupation: document.getElementById('create-occupation').value.trim(),
            monthlyIncome: income,
            philhealthIdNumber: document.getElementById('create-philhealth').value.trim(),
            childrenAges: childrenAgesArray,
            
            is_online: false, 
            auth_uid: null,
            proofIdUrl: null,
            proofSoloParentUrl: null,
            philhealthIdUrl: null,
            
            registrationDate: serverTimestamp(),
            lastUpdated: serverTimestamp()
        };

        const docRef = doc(db, "solo_parent_records", customId);
        await setDoc(docRef, newRecordData);

        document.getElementById('notificationModal').classList.remove('hidden');

    } catch (error) {
        console.error("Error creating manual record:", error);
        alert("Failed to save record to the database. Check console for details.");
    } finally {
        btn.innerHTML = '<i data-feather="save" class="w-4 h-4 mr-2"></i> Save Record';
        btn.disabled = false;
        if (typeof feather !== 'undefined') feather.replace();
    }
};