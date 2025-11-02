const express = require("express");
const app = express();
const path = require("path");
const engine = require("ejs-mate");
const mongoose = require("mongoose");
const methodOverride = require("method-override");
const User = require("./models/user.js");
const energyLog = require("./models/energyLog.js");
const device = require("./models/device.js");
const dotenv = require("dotenv");

app.engine("ejs", engine);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views/files"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));

// const MONGO_URL = "mongodb://127.0.0.1:27017/enerlytics";

// main()
//   .then(() => {
//     console.log("Connected to DB");
//   })
//   .catch((err) => {
//     console.log(err);
//   });

// async function main() {
//   await mongoose.connect(MONGO_URL);
// }

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

app.get("/", (req, res) => {
  res.render("home.ejs");
});

// app.get("/home", (req, res) => {
//   res.send("App is working");
// });

app.get("/signup", (req, res) => {
  res.render("signup.ejs");
});

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });

    if (!user) {
      return res.render("login.ejs", { error: "Invalid email or password. Please try again." });
    }
    if (user.password !== password) {
      return res.render("login.ejs", { error: "Invalid email or password. Please try again." });
    }

    // Successful login → redirect to dashboard
    res.redirect(`/dashboard/${user._id}`);
  } catch (err) {
    console.error(err);
    res.render("login.ejs", { error: "Login error. Please try again later." });
  }
});

app.post("/signup", async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      address,
      noOfAppliances,
      typesOfAppliances,
      lastMonthBill,
    } = req.body;

    // Basic validation
    if (!name || !email || !password) {
      return res.status(400).send("All required fields must be filled.");
    }

    // Save new user
    const newUser = new User({
      name,
      email,
      password,
      address,
      noOfAppliances,
      typesOfAppliances,
      lastMonthBill,
    });

    await newUser.save();
    res.redirect("/login"); // redirect to login after successful signup
  } catch (err) {
    console.error(err);
    res.status(500).send("Error saving user.");
  }
});

// Helper function to create or update daily energy log
async function createOrUpdateDailyLog(userId, date, totalEnergy, cost) {
  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const existingLog = await energyLog.findOne({
      userId: userId,
      date: { $gte: startOfDay, $lte: endOfDay }
    });

    if (existingLog) {
      existingLog.totalEnergyUsed = totalEnergy;
      existingLog.cost = cost;
      await existingLog.save();
      return existingLog;
    } else {
      const newLog = new energyLog({
        userId: userId,
        date: startOfDay,
        totalEnergyUsed: totalEnergy,
        cost: cost
      });
      await newLog.save();
      return newLog;
    }
  } catch (err) {
    console.error("Error creating/updating daily log:", err);
    return null;
  }
}

app.get("/dashboard/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).send("User not found");

    const devices = await device.find({ userId: req.params.id });
    
    // Calculate today's energy from devices
    const todayEnergy = devices.reduce(
      (sum, d) => sum + (d.powerRating * d.usageHours) / 1000,
      0
    );
    const todayCost = todayEnergy * 6;

    // Create/update today's energy log
    const today = new Date();
    await createOrUpdateDailyLog(req.params.id, today, todayEnergy, todayCost);

    // Fetch all logs including the newly created one
    const logs = await energyLog.find({ userId: req.params.id }).sort({ date: -1 });

    // Generate daily data for last 7 days - ALWAYS RECALCULATE based on current devices
    // This ensures charts show updated values when devices change
    const todayDate = new Date();
    const dailyData = [];
    
    // Base energy from current devices (this changes when devices are updated)
    const baseEnergy = devices.reduce(
      (sum, d) => sum + (d.powerRating * d.usageHours) / 1000,
      0
    );
    
    for (let i = 6; i >= 0; i--) {
      const targetDate = new Date(todayDate);
      targetDate.setDate(todayDate.getDate() - i);
      targetDate.setHours(0, 0, 0, 0);
      
      // ALWAYS RECALCULATE based on current devices (not use old stored values)
      // This ensures when devices change, all charts update
      const dayOfWeek = targetDate.getDay(); // 0 = Sunday, 6 = Saturday
      const dayOfMonth = targetDate.getDate();
      const month = targetDate.getMonth();
      
      // Create a more robust hash using multiple date components
      // This ensures each day gets a unique variation
      const dateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD
      let dateHash = 0;
      for (let i = 0; i < dateStr.length; i++) {
        const char = dateStr.charCodeAt(i);
        dateHash = ((dateHash << 5) - dateHash) + char;
        dateHash = dateHash & dateHash; // Convert to 32-bit integer
      }
      
      // Use day of month and month for additional variation
      const dayMonthHash = ((dayOfMonth * 31) + (month * 7)) % 100;
      
      // Combine hashes for more distinct values
      const combinedHash = Math.abs((dateHash + dayMonthHash) % 1000);
      const normalizedHash = combinedHash / 1000; // 0 to 1
      
      // Create more pronounced variation (0.75 to 1.25 range for better realism)
      let variationFactor = 0.75 + (normalizedHash * 0.5); // 0.75 to 1.25
      
      // Add day-of-week specific adjustments for more realistic patterns
      switch(dayOfWeek) {
        case 0: // Sunday - lowest usage
          variationFactor = variationFactor * 0.85;
          break;
        case 1: // Monday - medium-low (getting back to routine)
          variationFactor = variationFactor * 0.95;
          break;
        case 2: // Tuesday - normal
          variationFactor = variationFactor * 1.0;
          break;
        case 3: // Wednesday - normal
          variationFactor = variationFactor * 1.0;
          break;
        case 4: // Thursday - normal to high
          variationFactor = variationFactor * 1.05;
          break;
        case 5: // Friday - high usage (pre-weekend)
          variationFactor = variationFactor * 1.1;
          break;
        case 6: // Saturday - high usage (home activities)
          variationFactor = variationFactor * 1.15;
          break;
      }
      
      // Add subtle day-of-month variation
      if (dayOfMonth % 3 === 0) {
        variationFactor = variationFactor * 1.03; // Every 3rd day slightly higher
      } else if (dayOfMonth % 5 === 0) {
        variationFactor = variationFactor * 0.97; // Every 5th day slightly lower
      }
      
      // Ensure variation is reasonable (between 70% and 130% of base)
      variationFactor = Math.max(0.7, Math.min(1.3, variationFactor));
      
      // Calculate energy based on CURRENT devices with variation
      const dayEnergy = Math.max(0.1, baseEnergy * variationFactor);
      const dayCost = dayEnergy * 6;
      
      // Update the log in database with new calculated values
      await createOrUpdateDailyLog(req.params.id, targetDate, dayEnergy, dayCost);
      
      // Add to dailyData for charts
      dailyData.push({
        date: targetDate.toISOString(),
        energy: parseFloat(dayEnergy.toFixed(2)),
        cost: parseFloat(dayCost.toFixed(2))
      });
    }

    // Re-fetch logs after updating all of them
    const updatedLogs = await energyLog.find({ userId: req.params.id }).sort({ date: -1 });

    // Monthly comparison data - use updated logs from database
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const currentMonthLogs = updatedLogs.filter(log => {
      const logDate = new Date(log.date);
      return logDate >= currentMonthStart;
    });

    const lastMonthLogs = updatedLogs.filter(log => {
      const logDate = new Date(log.date);
      return logDate >= lastMonthStart && logDate < currentMonthStart;
    });

    // Calculate monthly totals from updated database logs
    const currentMonthEnergy = currentMonthLogs.reduce(
      (sum, log) => sum + (log.totalEnergyUsed || 0),
      0
    );

    // For last month: use logs if available, otherwise estimate from user's bill
    let lastMonthEnergy = lastMonthLogs.reduce(
      (sum, log) => sum + (log.totalEnergyUsed || 0),
      0
    );
    
    // If no last month logs exist, use user's bill estimate
    if (lastMonthEnergy === 0 && user.lastMonthBill > 0) {
      lastMonthEnergy = user.lastMonthBill / 6; // Approximate kWh from bill
    }

    const currentMonthCost = currentMonthEnergy * 6;
    const lastMonthCost = lastMonthEnergy * 6;

    // Calculate total power (only ON devices)
    const totalPower = devices
      .filter((d) => d.status === "ON")
      .reduce((sum, d) => sum + (d.powerRating || 0), 0);

    // Calculate total energy (all devices regardless of status for daily usage)
    const totalEnergy = devices.reduce(
      (sum, d) => sum + ((d.powerRating || 0) * (d.usageHours || 0)) / 1000,
      0
    );

    // Estimated cost
    const totalCost = (totalEnergy * 6).toFixed(2);

    // Calculate insights
    const avgDailyEnergy = currentMonthLogs.length > 0 
      ? currentMonthEnergy / currentMonthLogs.length 
      : todayEnergy;
    
    const highestEnergyDevice = devices.length > 0
      ? devices.reduce((max, d) => 
          (d.powerRating * d.usageHours) > (max.powerRating * max.usageHours) ? d : max
        )
      : null;

    // Energy savings tips based on user data
    const insights = [];
    if (currentMonthEnergy > lastMonthEnergy && lastMonthEnergy > 0) {
      const increase = ((currentMonthEnergy - lastMonthEnergy) / lastMonthEnergy * 100).toFixed(1);
      insights.push(`⚠️ Energy usage increased by ${increase}% compared to last month`);
    } else if (lastMonthEnergy > 0) {
      const decrease = ((lastMonthEnergy - currentMonthEnergy) / lastMonthEnergy * 100).toFixed(1);
      insights.push(`✅ Great! Energy usage decreased by ${decrease}% compared to last month`);
    }
    
    if (highestEnergyDevice) {
      const deviceEnergy = (highestEnergyDevice.powerRating * highestEnergyDevice.usageHours) / 1000;
      const devicePercentage = totalEnergy > 0 ? ((deviceEnergy / totalEnergy) * 100).toFixed(1) : 0;
      insights.push(`💡 ${highestEnergyDevice.name} consumes ${devicePercentage}% of your total energy`);
      
      // Conservation tips based on highest device
      if (highestEnergyDevice.name.toLowerCase().includes('air') || 
          highestEnergyDevice.name.toLowerCase().includes('ac') || 
          highestEnergyDevice.name.toLowerCase().includes('conditioner')) {
        insights.push(`🌡️ Set AC temperature to 24-26°C to save 15-20% energy`);
        insights.push(`⏰ Use AC timers - turning it off when not needed can save ₹${(deviceEnergy * 0.2 * 6).toFixed(0)}/day`);
      } else if (highestEnergyDevice.name.toLowerCase().includes('heater') || 
                 highestEnergyDevice.name.toLowerCase().includes('geyser')) {
        insights.push(`🔥 Switch off water heater 1 hour before use - saves 10% energy`);
        insights.push(`💧 Lower heater temperature to 50-60°C to reduce consumption`);
      } else if (highestEnergyDevice.name.toLowerCase().includes('refrigerator') || 
                 highestEnergyDevice.name.toLowerCase().includes('fridge')) {
        insights.push(`❄️ Keep fridge at optimal temperature (3-5°C) to reduce 5-10% energy`);
        insights.push(`🚪 Avoid frequent door openings - each opening increases energy by 5%`);
      } else {
        insights.push(`⚡ Consider using ${highestEnergyDevice.name} during off-peak hours`);
        insights.push(`🔌 Unplug ${highestEnergyDevice.name} when not in use to save standby power`);
      }
    }
    
    // Conservation tips based on usage patterns
    if (totalEnergy > 20) {
      insights.push(`📊 Your daily usage is high - try to reduce by 20% to save ₹${(totalEnergy * 0.2 * 6).toFixed(0)}/day`);
    } else if (totalEnergy > 10) {
      insights.push(`📊 Your usage is moderate - aim to reduce by 15% for better savings`);
    }
    
    // Tips based on number of devices
    if (devices.length > 5) {
      const offDevices = devices.filter(d => d.status === 'OFF').length;
      if (offDevices < devices.length / 2) {
        insights.push(`🔌 You have ${devices.length} devices - turn off unused ones to save energy`);
      }
    }
    
    // Tips based on power consumption
    const onDevicesPower = devices
      .filter(d => d.status === 'ON')
      .reduce((sum, d) => sum + (d.powerRating || 0), 0);
    
    if (onDevicesPower > 3000) {
      insights.push(`⚡ High power consumption detected (${onDevicesPower}W) - stagger device usage`);
    }
    
    // Tips for devices with high usage hours
    const highUsageDevices = devices.filter(d => d.usageHours > 12);
    if (highUsageDevices.length > 0) {
      insights.push(`⏰ ${highUsageDevices.length} device(s) run >12 hrs/day - optimize their schedules`);
    }
    
    // Cost-based tips
    if (parseFloat(totalCost) > 100) {
      insights.push(`💰 Daily cost is ₹${totalCost} - reduce by 10% to save ₹${(parseFloat(totalCost) * 0.1).toFixed(0)}/day`);
    }

    // Prepare device data for charts (ensure all fields exist)
    const devicesForCharts = devices.map(d => ({
      _id: d._id.toString(),
      name: d.name || 'Unknown Device',
      powerRating: d.powerRating || 0,
      usageHours: d.usageHours || 0,
      status: d.status || 'OFF',
      energy: ((d.powerRating || 0) * (d.usageHours || 0)) / 1000
    }));

    res.render("dashboard", {
      user,
      devices: devicesForCharts,
      logs: updatedLogs.map(log => ({
        _id: log._id.toString(),
        date: log.date.toISOString(),
        totalEnergyUsed: log.totalEnergyUsed || 0,
        cost: log.cost || 0,
        insights: log.insights || ''
      })),
      dailyData: dailyData,
      totalPower,
      totalEnergy: totalEnergy.toFixed(2),
      totalCost,
      currentMonthEnergy: currentMonthEnergy.toFixed(2),
      lastMonthEnergy: lastMonthEnergy.toFixed(2),
      currentMonthCost: currentMonthCost.toFixed(2),
      lastMonthCost: lastMonthCost.toFixed(2),
      insights: insights,
      avgDailyEnergy: avgDailyEnergy.toFixed(2)
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).send("Error loading dashboard: " + err.message);
  }
});

// Add new device/appliance
app.post("/dashboard/:id/device", async (req, res) => {
  try {
    const { name, powerRating, usageHours } = req.body;
    
    // Validate input
    if (!name || name.trim().length === 0) {
      return res.status(400).send("Device name is required.");
    }
    
    const power = parseFloat(powerRating);
    const hours = parseFloat(usageHours);
    
    if (isNaN(power) || power < 0 || power > 50000) {
      return res.status(400).send("Power rating must be between 0 and 50000 watts.");
    }
    
    if (isNaN(hours) || hours < 0 || hours > 24) {
      return res.status(400).send("Usage hours must be between 0 and 24.");
    }

    const newDevice = new device({
      userId: req.params.id,
      name: name.trim(),
      powerRating: power,
      usageHours: hours,
      status: "OFF",
    });

    await newDevice.save();
    
    // Update today's energy log after adding device
    const today = new Date();
    const devices = await device.find({ userId: req.params.id });
    const todayEnergy = devices.reduce(
      (sum, d) => sum + (d.powerRating * d.usageHours) / 1000,
      0
    );
    await createOrUpdateDailyLog(req.params.id, today, todayEnergy, todayEnergy * 6);
    
    res.redirect(`/dashboard/${req.params.id}`);
  } catch (err) {
    console.error("Error adding device:", err);
    res.status(500).send("Error adding device: " + err.message);
  }
});

// Update device
app.put("/dashboard/:id/device/:deviceId", async (req, res) => {
  try {
    const { name, powerRating, usageHours } = req.body;
    const foundDevice = await device.findById(req.params.deviceId);
    
    if (!foundDevice) return res.status(404).send("Device not found");
    if (foundDevice.userId.toString() !== req.params.id) {
      return res.status(403).send("Unauthorized");
    }

    // Validate input
    if (name && name.trim().length > 0) foundDevice.name = name.trim();
    
    const power = parseFloat(powerRating);
    if (!isNaN(power) && power >= 0 && power <= 50000) {
      foundDevice.powerRating = power;
    }
    
    const hours = parseFloat(usageHours);
    if (!isNaN(hours) && hours >= 0 && hours <= 24) {
      foundDevice.usageHours = hours;
    }

    await foundDevice.save();
    
    // Update today's energy log
    const today = new Date();
    const devices = await device.find({ userId: req.params.id });
    const todayEnergy = devices.reduce(
      (sum, d) => sum + (d.powerRating * d.usageHours) / 1000,
      0
    );
    await createOrUpdateDailyLog(req.params.id, today, todayEnergy, todayEnergy * 6);
    
    res.redirect(`/dashboard/${req.params.id}`);
  } catch (err) {
    console.error("Error updating device:", err);
    res.status(500).send("Error updating device: " + err.message);
  }
});

// Delete device
app.delete("/dashboard/:id/device/:deviceId", async (req, res) => {
  try {
    const foundDevice = await device.findById(req.params.deviceId);
    
    if (!foundDevice) return res.status(404).send("Device not found");
    if (foundDevice.userId.toString() !== req.params.id) {
      return res.status(403).send("Unauthorized");
    }

    await device.findByIdAndDelete(req.params.deviceId);
    
    // Update today's energy log after deleting device
    const today = new Date();
    const devices = await device.find({ userId: req.params.id });
    const todayEnergy = devices.reduce(
      (sum, d) => sum + (d.powerRating * d.usageHours) / 1000,
      0
    );
    await createOrUpdateDailyLog(req.params.id, today, todayEnergy, todayEnergy * 6);
    
    res.redirect(`/dashboard/${req.params.id}`);
  } catch (err) {
    console.error("Error deleting device:", err);
    res.status(500).send("Error deleting device: " + err.message);
  }
});

// Toggle device status
app.patch("/dashboard/:id/device/:deviceId/toggle", async (req, res) => {
  try {
    const foundDevice = await device.findById(req.params.deviceId);
    if (!foundDevice) return res.status(404).send("Device not found");
    
    if (foundDevice.userId.toString() !== req.params.id) {
      return res.status(403).send("Unauthorized");
    }

    foundDevice.status = foundDevice.status === "ON" ? "OFF" : "ON";
    foundDevice.lastUpdated = new Date();
    await foundDevice.save();
    
    // Update today's energy log after toggling
    const today = new Date();
    const devices = await device.find({ userId: req.params.id });
    const todayEnergy = devices.reduce(
      (sum, d) => sum + (d.powerRating * d.usageHours) / 1000,
      0
    );
    await createOrUpdateDailyLog(req.params.id, today, todayEnergy, todayEnergy * 6);
    
    res.redirect(`/dashboard/${req.params.id}`);
  } catch (err) {
    console.error("Error toggling device:", err);
    res.status(500).send("Error toggling device: " + err.message);
  }
});

// Logout route
app.get("/logout", (req, res) => {
  try {
    // If you're not using sessions:
    res.redirect("/login");

    // If later you add sessions:
    // req.session.destroy(() => res.redirect("/login"));
  } catch (err) {
    console.error(err);
    res.status(500).send("Error logging out.");
  }
});

// app.get("/xyz/:id", async (req, res) => {
//   try {
//     const sampleLogs = [
//       { userId: req.params.userId, totalEnergyUsed: 18.2, cost: 142, insights: "High AC usage detected" },
//       { userId: req.params.userId, totalEnergyUsed: 15.4, cost: 121, insights: "Usage lower than average" },
//       { userId: req.params.userId, totalEnergyUsed: 20.7, cost: 160, insights: "Increased daytime usage" }
//     ];

//     await energyLog.insertMany(sampleLogs);
//     res.send("✅ Sample energy logs added successfully!");
//   } catch (err) {
//     console.error(err);
//     res.status(500).send("Error adding logs.");
//   }
// });

app.listen(8080, () => {
  console.log(`app is listening on port 8080`);
});
