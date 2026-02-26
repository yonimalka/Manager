const express = require("express");
const axios = require("axios");
const UserModel = require("../models/User");
const authMiddleware = require("../authMiddleware");

const router = express.Router();

// Simple in-memory ZIP cache
const zipCache = {};

const isValidUSZip = (zip) => /^\d{5}(-\d{4})?$/.test(zip);

const zeroTax = (amount, reason = null) => ({
  subtotal: Number(amount),
  tax: 0,
  total: Number(amount),
  rate: 0,
  applied: false,
  reason,
});

router.post("/calculate-tax", authMiddleware, async (req, res) => {
  try {
    const { amount, to_zip } = req.body;

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    if (!to_zip || !isValidUSZip(to_zip)) {
      return res.status(400).json({ error: "Invalid US ZIP code" });
    }

    const user = await UserModel.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // If user disabled tax → always 0
    if (!user.taxSettings?.collectTax) {
      return res.json(zeroTax(numericAmount, "User not collecting tax"));
    }

    const businessState =
      user.taxSettings?.businessState || user.address?.state;

    if (!businessState) {
      return res.json(zeroTax(numericAmount, "Business state not set"));
    }

    let rate;
    let destinationState;
    console.log("API Key exists:", !!process.env.API_NINJAS_KEY);
    // 🔹 Check cache first
    if (zipCache[to_zip]) {
      rate = zipCache[to_zip].rate;
      destinationState = zipCache[to_zip].state;
    } else {
      const response = await axios.get(
        "https://api.api-ninjas.com/v1/salestax",
        {
          params: {
            zip_code: to_zip,
          },
          headers: {
            "X-Api-Key": process.env.API_NINJAS_KEY,
          },
        }
      );

      const data = response.data;

      if (!data || !data.length) {
        return res.json(zeroTax(numericAmount, "No tax data found"));
      }

      rate = data[0].total_rate || 0;
      destinationState = data[0].state;

      // Save in cache
      zipCache[to_zip] = {
        rate,
        state: destinationState,
      };
    }

    // Same-state only
    if (destinationState !== businessState) {
      return res.json(
        zeroTax(numericAmount, "Out-of-state transaction")
      );
    }

    const tax = +(numericAmount * rate).toFixed(2);
    const total = +(numericAmount + tax).toFixed(2);

    return res.json({
      subtotal: numericAmount,
      tax,
      total,
      rate,
      applied: true,
    });

  } catch (error) {
    console.error("Tax engine error:", error.response?.data || error);

    const numericAmount = Number(req.body.amount) || 0;

    return res.json(zeroTax(numericAmount, "Fallback mode"));
  }
});

module.exports = router;