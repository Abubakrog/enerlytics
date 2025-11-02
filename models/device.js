const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  name: String, // e.g. "Air Conditioner"
  powerRating: Number, // watts
  usageHours: Number, // daily usage hours
  status: { type: String, enum: ["ON", "OFF"], default: "OFF" },
  lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Device", deviceSchema);
