const jwt = require("jsonwebtoken");

const generateToken = (userId, res) => {
    const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
        expiresIn: "5d",
    });

    res.cookie("jwt", token, {
        httpOnly: true, // protect against XSS
        maxAge: 5 * 24 * 60 * 60 * 1000, // 5 days
        sameSite: "strict", // protect against CSRF
        secure: process.env.NODE_ENV !== "development", // use HTTPS in production
    });

    return token;
};

const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000); // 6-digit OTP
};

module.exports = {
    generateToken,
    generateOTP,
};
