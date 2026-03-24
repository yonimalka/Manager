const UserModel = require("../models/User");

const ACTIVE_STATUSES = new Set(["trialing", "active", "grace_period"]);

const hasActiveEntitlement = (subscription = {}, requiredEntitlement = "pro") => {
  return (
    subscription.entitlement === requiredEntitlement &&
    ACTIVE_STATUSES.has(subscription.status)
  );
};

const requireSubscription = (requiredEntitlement = "pro") => async (req, res, next) => {
  try {
    const user = await UserModel.findById(req.userId).select("subscription");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const subscription = user.subscription || {};
    const hasAccess = hasActiveEntitlement(subscription, requiredEntitlement);

    if (!hasAccess) {
      return res.status(402).json({
        message: "Active subscription required",
        code: "SUBSCRIPTION_REQUIRED",
        subscription,
      });
    }

    req.subscription = subscription;
    next();
  } catch (error) {
    console.error("requireSubscription error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  requireSubscription,
  ACTIVE_STATUSES,
  hasActiveEntitlement,
};
