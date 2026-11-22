const express = require("express");
const protect = require("../middleware/auth");
const authorizeRoles = require("../middleware/role");
const {
  getProfile,
  updateProfile,
  updatePassword,
  listResponders,
} = require("../controllers/user.controller");

const router = express.Router();

// Get logged-in user's profile
router.get("/profile", protect, getProfile);

// Update logged-in user's profile & emergency contacts
router.put("/profile", protect, updateProfile);

// Update logged-in user's password
router.put("/password", protect, updatePassword);

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