// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-analytics.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-storage.js";

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

let app, analytics, db, storage;

try {
    app = initializeApp(firebaseConfig);
    analytics = getAnalytics(app);
    db = getFirestore(app);
    storage = getStorage(app);
    console.log("✅ Firebase initialized successfully");
} catch (error) {
    console.error("❌ Firebase initialization error:", error);
}

export { app, analytics, db, storage };

