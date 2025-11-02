// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  address: {
    type: String,
    required: true,
  },
  noOfAppliances: {
    type: Number,
    required: true,
    min: 1,
  },
  typesOfAppliances: {
    type: [String], // example: ["Fan", "AC", "Fridge"]
    required: true,
  },
  lastMonthBill: {
    type: Number, // in ₹
    required: true,
  },
});

module.exports = mongoose.model("User", userSchema);
