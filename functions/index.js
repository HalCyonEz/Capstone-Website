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

/**
 * ==========================================
 * 3. SILENT ADMIN RENEWAL TRIGGER (v2)
 * Called by the frontend when an admin logs in.
 * Checks once per day for 30, 14, and 3-day expirations.
 * ==========================================
 */
exports.processRenewalReminders = onCall({ 
    region: "asia-southeast2", 
    cors: true 
}, async (request) => {
    const now = new Date();
    
    // Format the date strictly to Philippine Time so UTC rollovers don't trigger this twice a day
    const options = { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' };
    const formatter = new Intl.DateTimeFormat('en-CA', options);
    const todayString = formatter.format(now); // Outputs: YYYY-MM-DD

    // 1. SPAM PREVENTION: Check if we already sent reminders today
    const systemRef = db.collection("system_settings").doc("cron_tracker");
    const systemDoc = await systemRef.get();
    
    if (systemDoc.exists && systemDoc.data().lastRenewalRun === todayString) {
        console.log("Reminders already processed today. Skipping.");
        return { status: "skipped", message: "Already ran today" };
    }

    try {
        const usersSnapshot = await db.collection("users").where("status", "==", "approved").get();
        if (usersSnapshot.empty) return { status: "no_users" };

        const msPerDay = 1000 * 60 * 60 * 24;
        const notificationPromises = [];
        let totalSent = 0;

        // 2. CALCULATE EXACT RENEWAL DATES
        usersSnapshot.forEach((doc) => {
            const data = doc.data();
            const tokens = data.fcmTokens || [];
            if (tokens.length === 0) return; 

            // Find start date (fallback to approvedAt or createdAt)
            const baseTimestamp = data.lastRenewalDate || data.approvedAt || data.createdAt;
            if (!baseTimestamp) return;

            // Add exactly 1 year to the base date
            const baseDate = baseTimestamp.toDate();
            const expirationDate = new Date(baseDate.getTime());
            expirationDate.setFullYear(expirationDate.getFullYear() + 1);

            // Calculate exact days remaining
            const diffTime = expirationDate.getTime() - now.getTime();
            const daysRemaining = Math.round(diffTime / msPerDay);

            // 3. TARGET EXACT TIMEFRAMES (1 Month, 2 Weeks, 3 Days)
            if ([30, 14, 3].includes(daysRemaining)) {
                totalSent++;
                
                let urgency = daysRemaining === 3 ? "URGENT: " : "";
                
                const message = {
                    notification: {
                        title: `${urgency}Solo Parent ID Renewal`,
                        body: `Your ID expires in exactly ${daysRemaining} days. Please prepare your renewal documents.`,
                    },
                    tokens: tokens, 
                };

                // Send and include token cleanup
                const sendPromise = admin.messaging().sendEachForMulticast(message).then(async (response) => {
                    if (response.failureCount > 0) {
                        const invalidTokens = [];
                        response.responses.forEach((resp, idx) => {
                            if (!resp.success && (resp.error.code === "messaging/invalid-registration-token" || resp.error.code === "messaging/registration-token-not-registered")) {
                                invalidTokens.push(tokens[idx]);
                            }
                        });
                        if (invalidTokens.length > 0) {
                            await db.collection("users").doc(doc.id).update({
                                fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens)
                            });
                        }
                    }
                });

                notificationPromises.push(sendPromise);
            }
        });

        // 4. EXECUTE & UPDATE TRACKER
        if (notificationPromises.length > 0) {
            await Promise.all(notificationPromises);
        }

        // Lock it so it doesn't run again today
        await systemRef.set({ lastRenewalRun: todayString }, { merge: true });

        console.log(`Successfully sent ${totalSent} renewal reminders.`);
        return { status: "success", sent: totalSent };

    } catch (error) {
        console.error("Error processing renewals:", error);
        throw new Error("Failed to process renewals");
    }
});