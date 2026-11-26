const express = require("express");
const protect = require("../middleware/auth");
const authorizeRoles = require("../middleware/role");
const { getProfile, updateProfile, listResponders } = require("../controllers/user.controller");

const router = express.Router();

// Get logged-in user's profile
router.get("/profile", protect, getProfile);

// Update logged-in user's profile (name, phone)
router.patch("/profile", protect, updateProfile);

// List responders (supervisor/admin/responder — used for assignment UI)
router.get(
  "/responders",
  protect,
  authorizeRoles("supervisor", "admin", "responder"),
  listResponders
);

// Admin only
router.get(
  "/admin-test",
  protect,
  authorizeRoles("admin"),
  (req, res) => {
    res.json({
      message: "Welcome Admin! You have access to this route.",
      user: req.user,
    });
  }
);

module.exports = router;