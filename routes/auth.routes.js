const express = require('express');

const { checkAuth, login, logout, signup, updateProfile, verifyOTP } = require("../controllers/auth.controller.js") ;
const { protectRoute } = require("../middleware/auth.middleware.js") ;
// import { unreadCounts } from "../controllers/message.controller.js";

const router = express.Router();

router.post("/signup", signup);

router.post("/login", login);

router.post("/logout", logout);

router.put("/update-profile", protectRoute, updateProfile);

router.get("/check", protectRoute, checkAuth)

router.post("/verify-email", verifyOTP)

// router.get("/unreadCounts", protectRoute, unreadCounts)

module.exports = router;
