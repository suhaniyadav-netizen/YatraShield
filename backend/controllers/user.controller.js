
const User = require("../models/user");

// Get logged-in user's profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.user_id)
      .select("-password");

    if(!user){
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json({
      message: "Profile fetched successfully",
      user,
    });
  }catch (error){
    console.error("Get profile error:", error.message);

    return res.status(500).json({
      message: "Failed to fetch profile",
    });
  }
};

// Update logged-in user's profile (name, phone)
const updateProfile = async (req, res) => {
  try {
    const { name, phone } = req.body;
    const user = await User.findById(req.user.user_id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim() || name.trim().length > 100) {
        return res.status(400).json({
          message: "Name must be between 1 and 100 characters",
        });
      }
      user.name = name.trim();
    }

    if (phone !== undefined) {
      if (typeof phone !== "string") {
        return res.status(400).json({
          message: "Phone must be a string",
        });
      }
      const trimmedPhone = phone.trim();
      if (trimmedPhone && !/^[+0-9\s\-()]{7,20}$/.test(trimmedPhone)) {
        return res.status(400).json({
          message: "Please provide a valid phone number (7-20 digits and symbols)",
        });
      }
      user.phone = trimmedPhone;
    }

    await user.save();

    return res.status(200).json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error.message);
    return res.status(500).json({
      message: "Failed to update profile",
    });
  }
};

// List responder accounts (for supervisor/admin assignment dropdowns)
const listResponders = async (req, res) => {
  try {
    const responders = await User.find({ role: "responder" })
      .select("name email phone _id createdAt")
      .sort({ name: 1 });

    return res.status(200).json({
      message: "Responders fetched successfully",
      count: responders.length,
      responders,
    });
  } catch (error) {
    console.error("List responders error:", error.message);
    return res.status(500).json({
      message: "Failed to fetch responders",
    });
  }
};

module.exports = { getProfile, updateProfile, listResponders };
