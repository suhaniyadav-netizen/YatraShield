const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/user");
const {
  updateProfile,
  updatePassword,
} = require("../controllers/user.controller");

test("User Schema includes phone, bloodGroup, and emergencyContact fields with defaults", () => {
  const user = new User({
    name: "Aarav Sharma",
    email: "aarav@example.com",
    password: "hashedpassword123",
  });

  assert.equal(user.phone, "");
  assert.equal(user.bloodGroup, "");
  assert.deepEqual(user.emergencyContact.toObject(), {
    name: "",
    phone: "",
    relationship: "",
  });

  user.phone = "+91 9876543210";
  user.bloodGroup = "O+";
  user.emergencyContact = {
    name: "Pooja Sharma",
    phone: "+91 9876543211",
    relationship: "Sister",
  };

  assert.equal(user.phone, "+91 9876543210");
  assert.equal(user.bloodGroup, "O+");
  assert.equal(user.emergencyContact.name, "Pooja Sharma");
  assert.equal(user.emergencyContact.phone, "+91 9876543211");
  assert.equal(user.emergencyContact.relationship, "Sister");
});

test("updateProfile successfully updates profile and emergency contacts", async () => {
  const fakeUserId = new mongoose.Types.ObjectId();
  const fakeUser = {
    _id: fakeUserId,
    name: "Old Name",
    email: "tourist@example.com",
    role: "tourist",
    phone: "",
    bloodGroup: "",
    emergencyContact: {
      name: "",
      phone: "",
      relationship: "",
    },
    save: async function () {
      return this;
    },
    toObject: function () {
      return {
        _id: this._id,
        name: this.name,
        email: this.email,
        role: this.role,
        phone: this.phone,
        bloodGroup: this.bloodGroup,
        emergencyContact: this.emergencyContact,
      };
    },
  };

  const origFindById = User.findById;
  User.findById = async (id) => {
    if (id.toString() === fakeUserId.toString()) return fakeUser;
    return null;
  };

  try {
    const req = {
      user: { user_id: fakeUserId.toString(), role: "tourist" },
      body: {
        name: "Aarav Sharma",
        phone: "+91 9876543210",
        bloodGroup: "b+",
        emergencyContact: {
          name: "Ravi Sharma",
          phone: "+91 9123456789",
          relationship: "Brother",
        },
      },
    };

    let responseStatus = 0;
    let responseData = null;
    const res = {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      },
    };

    await updateProfile(req, res);

    assert.equal(responseStatus, 200);
    assert.equal(responseData.message, "Profile updated successfully");
    assert.equal(fakeUser.name, "Aarav Sharma");
    assert.equal(fakeUser.phone, "+91 9876543210");
    assert.equal(fakeUser.bloodGroup, "B+");
    assert.equal(fakeUser.emergencyContact.name, "Ravi Sharma");
    assert.equal(fakeUser.emergencyContact.phone, "+91 9123456789");
    assert.equal(fakeUser.emergencyContact.relationship, "Brother");
  } finally {
    User.findById = origFindById;
  }
});

test("updateProfile validates invalid blood group, phone, and name", async () => {
  const fakeUserId = new mongoose.Types.ObjectId();
  const reqInvalidBlood = {
    user: { user_id: fakeUserId.toString(), role: "tourist" },
    body: { bloodGroup: "INVALID" },
  };

  let status = 0;
  let data = null;
  const res = {
    status(c) {
      status = c;
      return this;
    },
    json(d) {
      data = d;
      return this;
    },
  };

  await updateProfile(reqInvalidBlood, res);
  assert.equal(status, 400);
  assert.ok(data.message.includes("Invalid blood group"));

  // Invalid name
  const reqInvalidName = {
    user: { user_id: fakeUserId.toString(), role: "tourist" },
    body: { name: "" },
  };
  await updateProfile(reqInvalidName, res);
  assert.equal(status, 400);
  assert.ok(data.message.includes("Name must be between"));

  // Invalid phone format
  const reqInvalidPhone = {
    user: { user_id: fakeUserId.toString(), role: "tourist" },
    body: { phone: "abc!!" },
  };
  await updateProfile(reqInvalidPhone, res);
  assert.equal(status, 400);
  assert.ok(data.message.includes("valid phone number"));
});

test("updatePassword verifies current password and updates with hashed password", async () => {
  const fakeUserId = new mongoose.Types.ObjectId();
  const currentPlainPassword = "currentSecurePassword123";
  const hashedPassword = await bcrypt.hash(currentPlainPassword, 10);

  const fakeUser = {
    _id: fakeUserId,
    password: hashedPassword,
    save: async function () {
      return this;
    },
  };

  const origFindById = User.findById;
  User.findById = async (id) => {
    if (id.toString() === fakeUserId.toString()) return fakeUser;
    return null;
  };

  try {
    let status = 0;
    let data = null;
    const res = {
      status(c) {
        status = c;
        return this;
      },
      json(d) {
        data = d;
        return this;
      },
    };

    // 1. Wrong current password
    await updatePassword(
      {
        user: { user_id: fakeUserId.toString() },
        body: { currentPassword: "wrongPassword!", newPassword: "newSuperPassword123" },
      },
      res
    );
    assert.equal(status, 400);
    assert.equal(data.message, "Current password is incorrect");

    // 2. Too short new password
    await updatePassword(
      {
        user: { user_id: fakeUserId.toString() },
        body: { currentPassword: currentPlainPassword, newPassword: "short" },
      },
      res
    );
    assert.equal(status, 400);
    assert.ok(data.message.includes("at least 8 characters"));

    // 3. Successful password change
    const newPlainPassword = "brandNewPassword2026!";
    await updatePassword(
      {
        user: { user_id: fakeUserId.toString() },
        body: { currentPassword: currentPlainPassword, newPassword: newPlainPassword },
      },
      res
    );
    assert.equal(status, 200);
    assert.equal(data.message, "Password updated successfully");

    // Check that new password was hashed and matches
    const isNewPasswordValid = await bcrypt.compare(newPlainPassword, fakeUser.password);
    assert.ok(isNewPasswordValid, "New password should be correctly hashed in user record");
  } finally {
    User.findById = origFindById;
  }
});
