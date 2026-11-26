
const bcrypt = require("bcryptjs");
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

// Update logged-in user's profile & emergency contacts
const updateProfile = async (req, res) => {
  try {
    const { name, phone, bloodGroup, emergencyContact } = req.body;

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim() || name.trim().length > 100) {
        return res.status(400).json({
          message: "Name must be between 1 and 100 characters",
        });
      }
    }

    if (phone !== undefined) {
      if (typeof phone !== "string") {
        return res.status(400).json({
          message: "Phone must be a string",
        });
      }
      const trimmedPhone = phone.trim();
      if (trimmedPhone.length > 25) {
        return res.status(400).json({
          message: "Phone number cannot exceed 25 characters",
        });
      }
      if (trimmedPhone && !/^[+0-9\s\-()]{4,25}$/.test(trimmedPhone)) {
        return res.status(400).json({
          message: "Please enter a valid phone number",
        });
      }
    }

    if (bloodGroup !== undefined) {
      if (typeof bloodGroup !== "string") {
        return res.status(400).json({
          message: "Blood group must be a string",
        });
      }
      const normalizedBlood = bloodGroup.trim().toUpperCase();
      const allowedBloodGroups = ["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
      if (!allowedBloodGroups.includes(normalizedBlood)) {
        return res.status(400).json({
          message: "Invalid blood group. Allowed: A+, A-, B+, B-, AB+, AB-, O+, O-",
        });
      }
    }

    if (emergencyContact !== undefined) {
      if (!emergencyContact || typeof emergencyContact !== "object" || Array.isArray(emergencyContact)) {
        return res.status(400).json({
          message: "Emergency contact must be an object",
        });
      }

      if (emergencyContact.name !== undefined) {
        if (typeof emergencyContact.name !== "string" || emergencyContact.name.trim().length > 100) {
          return res.status(400).json({
            message: "Emergency contact name cannot exceed 100 characters",
          });
        }
      }

      if (emergencyContact.phone !== undefined) {
        if (typeof emergencyContact.phone !== "string") {
          return res.status(400).json({
            message: "Emergency contact phone must be a string",
          });
        }
        const trimmedEcPhone = emergencyContact.phone.trim();
        if (trimmedEcPhone.length > 25) {
          return res.status(400).json({
            message: "Emergency contact phone cannot exceed 25 characters",
          });
        }
        if (trimmedEcPhone && !/^[+0-9\s\-()]{4,25}$/.test(trimmedEcPhone)) {
          return res.status(400).json({
            message: "Please enter a valid emergency contact phone number",
          });
        }
      }

      if (emergencyContact.relationship !== undefined) {
        if (typeof emergencyContact.relationship !== "string" || emergencyContact.relationship.trim().length > 50) {
          return res.status(400).json({
            message: "Relationship cannot exceed 50 characters",
          });
        }
      }
    }

    const user = await User.findById(req.user.user_id);
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (name !== undefined) user.name = name.trim();
    if (phone !== undefined) user.phone = phone.trim();
    if (bloodGroup !== undefined) user.bloodGroup = bloodGroup.trim().toUpperCase();

    if (emergencyContact !== undefined) {
      if (!user.emergencyContact) {
        user.emergencyContact = {};
      }
      if (emergencyContact.name !== undefined) {
        user.emergencyContact.name = emergencyContact.name.trim();
      }
      if (emergencyContact.phone !== undefined) {
        user.emergencyContact.phone = emergencyContact.phone.trim();
      }
      if (emergencyContact.relationship !== undefined) {
        user.emergencyContact.relationship = emergencyContact.relationship.trim();
      }
    }

    await user.save();

    const safeUser = user.toObject();
    delete safeUser.password;

    return res.status(200).json({
      message: "Profile updated successfully",
      user: safeUser,
    });
  } catch (error) {
    console.error("Update profile error:", error.message);
    return res.status(500).json({
      message: "Failed to update profile",
    });
  }
};

// Update logged-in user's password
const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (
      typeof currentPassword !== "string" ||
      !currentPassword ||
      typeof newPassword !== "string" ||
      !newPassword
    ) {
      return res.status(400).json({
        message: "Current password and new password are required",
      });
    }

    if (newPassword.length < 8 || Buffer.byteLength(newPassword, "utf8") > 72) {
      return res.status(400).json({
        message: "New password must be at least 8 characters and at most 72 bytes",
      });
    }

    const user = await User.findById(req.user.user_id);
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        message: "Current password is incorrect",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    return res.status(200).json({
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("Update password error:", error.message);
    return res.status(500).json({
      message: "Failed to update password",
    });
  }
};

// List responder accounts (for supervisor/admin assignment dropdowns)
const listResponders = async (req, res) => {
  try {
    const responders = await User.find({ role: "responder" })
      .select("name email _id createdAt")
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

module.exports = {
  getProfile,
  updateProfile,
  updatePassword,
  listResponders,
};
