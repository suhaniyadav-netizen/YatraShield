const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Incident = require("../models/incident");
const {
  updateIncidentStatus,
  addIncidentNote,
  assignIncident,
} = require("../controllers/incident.controller");
const User = require("../models/user");

test("Incident Schema includes notes and statusNotes fields", () => {
  const incident = new Incident({
    reportedBy: new mongoose.Types.ObjectId(),
    category: "medical",
    description: "Tourist injured on hiking trail",
    location: {
      type: "Point",
      coordinates: [77.03, 28.45],
    },
    notes: "Initial report received",
    statusNotes: [
      {
        status: "REPORTED",
        note: "Initial triage completed",
        addedBy: new mongoose.Types.ObjectId(),
        addedAt: new Date(),
      },
    ],
  });

  assert.equal(incident.notes, "Initial report received");
  assert.equal(incident.statusNotes.length, 1);
  assert.equal(incident.statusNotes[0].status, "REPORTED");
  assert.equal(incident.statusNotes[0].note, "Initial triage completed");
  assert.ok(incident.statusNotes[0].addedBy instanceof mongoose.Types.ObjectId);
});

test("updateIncidentStatus validates status transitions and saves notes", async () => {
  const fakeIncidentId = new mongoose.Types.ObjectId();
  const fakeReporterId = new mongoose.Types.ObjectId();
  const fakeResponderId = new mongoose.Types.ObjectId();

  const fakeIncident = {
    _id: fakeIncidentId,
    reportedBy: fakeReporterId,
    assignedResponder: fakeResponderId,
    status: "ON_SITE",
    category: "medical",
    priority: "high",
    notes: "",
    statusNotes: [],
    save: async function () {
      return this;
    },
    populate: async function () {
      return this;
    },
  };

  // Mock Incident.findById
  const originalFindById = Incident.findById;
  Incident.findById = async (id) => {
    if (id.toString() === fakeIncidentId.toString()) {
      return fakeIncident;
    }
    return null;
  };

  const emitted = [];
  const fakeIo = {
    to: (room) => ({
      emit: (event, payload) => {
        emitted.push({ room, event, payload });
      },
    }),
  };

  const req = {
    params: { id: fakeIncidentId.toString() },
    user: { user_id: fakeResponderId.toString(), role: "responder" },
    body: {
      status: "RESOLVED",
      note: "Patient received first aid and transported safely.",
    },
    app: {
      get: (key) => (key === "io" ? fakeIo : null),
    },
  };

  let responseStatus = null;
  let responseBody = null;
  const res = {
    status: (code) => {
      responseStatus = code;
      return {
        json: (data) => {
          responseBody = data;
        },
      };
    },
  };

  try {
    await updateIncidentStatus(req, res);

    assert.equal(responseStatus, 200);
    assert.equal(fakeIncident.status, "RESOLVED");
    assert.equal(fakeIncident.notes, "Patient received first aid and transported safely.");
    assert.equal(fakeIncident.statusNotes.length, 1);
    assert.equal(fakeIncident.statusNotes[0].status, "RESOLVED");
    assert.equal(fakeIncident.statusNotes[0].note, "Patient received first aid and transported safely.");
    assert.equal(emitted.length, 2); // reporter and responder
    assert.equal(emitted[0].event, "incident:status_updated");
    assert.equal(emitted[0].payload.note, "Patient received first aid and transported safely.");
  } finally {
    Incident.findById = originalFindById;
  }
});

test("assignIncident allows reassigning ASSIGNED incidents and notifies previous responder", async () => {
  const fakeIncidentId = new mongoose.Types.ObjectId();
  const fakeReporterId = new mongoose.Types.ObjectId();
  const oldResponderId = new mongoose.Types.ObjectId();
  const newResponderId = new mongoose.Types.ObjectId();
  const supervisorId = new mongoose.Types.ObjectId();

  const fakeIncident = {
    _id: fakeIncidentId,
    reportedBy: fakeReporterId,
    assignedResponder: oldResponderId,
    status: "ASSIGNED",
    category: "accident",
    description: "Road collision",
    priority: "high",
    location: { type: "Point", coordinates: [77.0, 28.0] },
    statusNotes: [],
    save: async function () {
      return this;
    },
    populate: async function () {
      return this;
    },
  };

  const originalIncidentFindById = Incident.findById;
  const originalUserFindById = User.findById;
  const originalUserFind = User.find;

  Incident.findById = async (id) => {
    if (id.toString() === fakeIncidentId.toString()) return fakeIncident;
    return null;
  };

  User.findById = async (id) => {
    if (id.toString() === newResponderId.toString()) {
      return { _id: newResponderId, name: "New Responder", role: "responder" };
    }
    return null;
  };

  User.find = () => ({
    select: async () => [{ _id: supervisorId }],
  });

  const emitted = [];
  const fakeIo = {
    to: (room) => ({
      emit: (event, payload) => {
        emitted.push({ room, event, payload });
      },
    }),
  };

  const req = {
    params: { id: fakeIncidentId.toString() },
    user: { user_id: supervisorId.toString(), role: "supervisor" },
    body: { responderId: newResponderId.toString() },
    app: { get: (k) => (k === "io" ? fakeIo : null) },
  };

  let responseStatus = null;
  let responseBody = null;
  const res = {
    status: (code) => {
      responseStatus = code;
      return {
        json: (data) => {
          responseBody = data;
        },
      };
    },
  };

  try {
    await assignIncident(req, res);

    assert.equal(responseStatus, 200);
    assert.equal(fakeIncident.status, "ASSIGNED");
    assert.equal(fakeIncident.assignedResponder.toString(), newResponderId.toString());
    assert.equal(fakeIncident.statusNotes.length, 1);
    assert.ok(fakeIncident.statusNotes[0].note.includes("Incident reassigned"));

    // Verify socket notifications: new responder gets assigned, old responder and reporter get reassigned
    const assignedEvents = emitted.filter((e) => e.event === "incident:assigned");
    const reassignedEvents = emitted.filter((e) => e.event === "incident:reassigned");

    assert.equal(assignedEvents.length, 1);
    assert.equal(assignedEvents[0].room, `user:${newResponderId}`);

    // Reassigned notifications should be sent to reporter, old responder, supervisor
    const notifiedRooms = reassignedEvents.map((e) => e.room);
    assert.ok(notifiedRooms.includes(`user:${fakeReporterId}`));
    assert.ok(notifiedRooms.includes(`user:${oldResponderId}`));
    assert.ok(notifiedRooms.includes(`user:${supervisorId}`));
  } finally {
    Incident.findById = originalIncidentFindById;
    User.findById = originalUserFindById;
    User.find = originalUserFind;
  }
});

test("addIncidentNote appends progress note to incident without changing status", async () => {
  const fakeIncidentId = new mongoose.Types.ObjectId();
  const fakeReporterId = new mongoose.Types.ObjectId();
  const fakeResponderId = new mongoose.Types.ObjectId();

  const fakeIncident = {
    _id: fakeIncidentId,
    reportedBy: fakeReporterId,
    assignedResponder: fakeResponderId,
    status: "EN_ROUTE",
    notes: "",
    statusNotes: [],
    save: async function () {
      return this;
    },
    populate: async function () {
      return this;
    },
  };

  const originalFindById = Incident.findById;
  Incident.findById = async (id) => (id.toString() === fakeIncidentId.toString() ? fakeIncident : null);

  const emitted = [];
  const fakeIo = {
    to: (room) => ({
      emit: (event, payload) => {
        emitted.push({ room, event, payload });
      },
    }),
  };

  const req = {
    params: { id: fakeIncidentId.toString() },
    user: { user_id: fakeResponderId.toString(), role: "responder" },
    body: { note: "Encountered traffic delay, ETA 4 minutes." },
    app: { get: (k) => (k === "io" ? fakeIo : null) },
  };

  let responseStatus = null;
  let responseBody = null;
  const res = {
    status: (code) => {
      responseStatus = code;
      return {
        json: (data) => {
          responseBody = data;
        },
      };
    },
  };

  try {
    await addIncidentNote(req, res);

    assert.equal(responseStatus, 200);
    assert.equal(fakeIncident.status, "EN_ROUTE");
    assert.equal(fakeIncident.notes, "Encountered traffic delay, ETA 4 minutes.");
    assert.equal(fakeIncident.statusNotes.length, 1);
    assert.equal(fakeIncident.statusNotes[0].status, "EN_ROUTE");
    assert.equal(fakeIncident.statusNotes[0].note, "Encountered traffic delay, ETA 4 minutes.");

    const noteEvents = emitted.filter((e) => e.event === "incident:note_added");
    assert.equal(noteEvents.length, 2); // reporter and responder
  } finally {
    Incident.findById = originalFindById;
  }
});
