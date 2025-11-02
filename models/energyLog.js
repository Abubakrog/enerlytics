const mongoose = require("mongoose");

const energyLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  date: { type: Date, default: Date.now },
  totalEnergyUsed: Number, // in kWh
  cost: Number, // ₹
  insights: String // e.g., "AC used 40% more energy today"
});

module.exports = mongoose.model("EnergyLog", energyLogSchema);
