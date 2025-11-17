// Import v2 triggers
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

// Initialize Admin SDK
admin.initializeApp();

/**
 * AUTOMATIC ANNOUNCEMENTS (v2)
 * Triggers when a document is created in 'announcements' collection
 */
exports.sendAnnouncementNotification = onDocumentCreated({
  region: "asia-southeast2",
  document: "announcements/{docId}"
}, async (event) => {
    
    // 1. Get the snapshot from the event
    const snapshot = event.data;

    // Safety check: If there's no data, stop
    if (!snapshot) {
        console.log("No data associated with the event");
        return;
    }

    const data = snapshot.data();

    // 2. Check for title/body
    if (!data.title || !data.body) {
        console.log("Missing title or body. Skipping.");
        return;
    }

    // 3. Create Payload
    const payload = {
        notification: {
            title: data.title,
            body: data.body,
        },
        topic: "announcements"
    };

    // 4. Send Notification
    try {
        await admin.messaging().send(payload);
        console.log("✅ Notification sent successfully");
    } catch (error) {
        console.error("❌ Error sending notification:", error);
    }
});