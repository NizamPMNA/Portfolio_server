const cron = require("node-cron");
const User = require("../models/user.model.js");

// Scheduled Job to Delete Unverified Users Older Than 1 Hour
const deleteUnverifiedUsers = async () => {
    try {
        const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000); // 1 hour ago

        const result = await User.deleteMany({
            verified: false,
            createdAt: { $lt: oneHourAgo },
        });

        console.log(`Deleted ${result.deletedCount} unverified users.`);
    } catch (error) {
        console.error("Error deleting unverified users:", error);
    }
};

cron.schedule("0 * * * *", deleteUnverifiedUsers); // Runs every hour at minute 0

module.exports = deleteUnverifiedUsers;
