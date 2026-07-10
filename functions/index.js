// Import v2 triggers
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onCall } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

// Initialize Admin SDK
admin.initializeApp();

// Initialize Firestore for token cleanup
const db = admin.firestore(); 

/**
 * ==========================================
 * 1. AUTOMATIC ANNOUNCEMENTS (v2)
 * Triggers when a document is created in 'announcements' collection
 * ==========================================
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
        console.log("✅ Announcement Notification sent successfully");
    } catch (error) {
        console.error("❌ Error sending announcement notification:", error);
    }
});

/**
 * ==========================================
 * 2. APPROVAL/REJECTION UNICAST NOTIFICATIONS (v2)
 * Triggers when a document is updated in the 'users' collection
 * ==========================================
 */
exports.notifyUserOnStatusChange = onDocumentUpdated({
  region: "asia-southeast2",
  document: "users/{userId}"
}, async (event) => {
    const newValue = event.data.after.data();
    const previousValue = event.data.before.data();
    const userId = event.params.userId;

    // 1. Target Condition: Only trigger if the status has actually changed
    if (newValue.status === previousValue.status) {
        return; 
    }

    const newStatus = newValue.status;
    const tokens = newValue.fcmTokens;

    // 2. Clean Error Handling: Check for missing/empty tokens
    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
        console.warn(`[SPDA Notice] Cannot send notification to ${userId}. No FCM tokens available.`);
        return;
    }

    // 3. Construct the Payload conditionally
    let notificationTitle = "";
    let notificationBody = "";

    if (newStatus === "approved") {
        notificationTitle = "Account Approved! 🎉";
        notificationBody = "Welcome to the SPDA App. Your solo parent verification is complete and full access is now unlocked.";
    } else if (newStatus === "rejected") {
        const reason = newValue.rejectReason || "Please review your submitted documents.";
        notificationTitle = "Application Rejected ❌";
        notificationBody = `Your application was rejected: ${reason}. Please check your profile to update and resubmit.`;
    } else {
        // Ignore other status changes
        return; 
    }

    const message = {
        notification: {
            title: notificationTitle,
            body: notificationBody,
        },
        tokens: tokens, // Unicast targeted array
    };

    try {
        // 4. Send targeted push notification
        const response = await admin.messaging().sendEachForMulticast(message);
        console.log(`✅ [SPDA Success] Notification sent to ${response.successCount} devices for user ${userId}.`);

        // 5. Token Cleanup: Remove stale, unregistered, or invalid tokens
        if (response.failureCount > 0) {
            const invalidTokens = [];
            
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const errorCode = resp.error.code;
                    if (
                        errorCode === "messaging/invalid-registration-token" ||
                        errorCode === "messaging/registration-token-not-registered"
                    ) {
                        invalidTokens.push(tokens[idx]);
                    }
                }
            });

            if (invalidTokens.length > 0) {
                console.log(`🧹 [SPDA Cleanup] Removing ${invalidTokens.length} stale tokens for user ${userId}.`);
                
                await db.collection("users").doc(userId).update({
                    fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens)
                });
            }
        }
    } catch (error) {
        console.error(`❌ [SPDA Error] Failed to send FCM notification to ${userId}:`, error);
    }
});