import api from "./api";
import {
  getEntitlementState,
  getRevenueCatCustomerInfo,
  restoreRevenueCatPurchases,
  getRevenueCatPackages,
  purchaseRevenueCatPackage,
  presentRevenueCatCustomerCenter,
  presentRevenueCatPaywall,
  presentRevenueCatPaywallIfNeeded,
  PAYWALL_RESULT,
} from "./revenuecat";

export const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  "trialing",
  "active",
  "grace_period",
]);

export const PRO_FEATURES = {
  unlimitedProjects: "unlimitedProjects",
  advancedFinance: "advancedFinance",
  receiptExports: "receiptExports",
  employeeManagement: "employeeManagement",
  aiQuotes: "aiQuotes",
};

export async function fetchSubscriptionStatus() {
  const response = await api.get("/subscription/status");
  return response.data?.subscription || null;
}

export async function syncSubscriptionFromCustomerInfo(customerInfo, lastEventType = "APP_SYNC") {
  const entitlementState = getEntitlementState(customerInfo);

  const response = await api.post("/subscription/sync", {
    productId: entitlementState.productId,
    entitlement: entitlementState.entitlementId,
    status: entitlementState.status,
    trialEndsAt: entitlementState.trialEndsAt,
    expiresAt: entitlementState.expiresAt,
    willRenew: entitlementState.willRenew,
    lastEventType,
  });

  return response.data?.subscription || null;
}

export async function refreshSubscriptionStatus() {
  const customerInfo = await getRevenueCatCustomerInfo();

  if (customerInfo) {
    // Fire server sync in background — don't block the UI on it
    syncSubscriptionFromCustomerInfo(customerInfo, "CUSTOMER_INFO_REFRESH").catch(
      (err) => console.error("[sub] background sync failed:", err)
    );

    // Return RC state directly so the UI is always accurate
    const s = getEntitlementState(customerInfo);
    return {
      provider: "revenuecat",
      entitlement: s.entitlementId,
      productId: s.productId,
      status: s.status,
      hasAccess: s.hasAccess,
      trialEndsAt: s.trialEndsAt,
      expiresAt: s.expiresAt,
      willRenew: s.willRenew,
      lastSyncedAt: new Date().toISOString(),
    };
  }

  // RC not configured yet — fall back to server
  try {
    return await fetchSubscriptionStatus();
  } catch {
    return null;
  }
}

export async function purchaseProPackage(selectedPackage) {
  const result = await purchaseRevenueCatPackage(selectedPackage);

  if (result?.cancelled) {
    return { cancelled: true };
  }

  const subscription = await syncSubscriptionFromCustomerInfo(
    result.customerInfo,
    "PURCHASED_IN_APP"
  );

  return {
    cancelled: false,
    subscription,
    customerInfo: result.customerInfo,
    productId: result.productId,
    storeProduct: result.storeProduct,
    selectedPackage: result.selectedPackage,
  };
}

export async function restoreProSubscription() {
  const customerInfo = await restoreRevenueCatPurchases();
  const subscription = await syncSubscriptionFromCustomerInfo(
    customerInfo,
    "RESTORED_IN_APP"
  );

  return { subscription, customerInfo };
}

export async function fetchProOffering() {
  const { currentOffering, packages, entitlementId } = await getRevenueCatPackages();

  return {
    currentOffering,
    entitlementId,
    monthly: packages.monthly || null,
    yearly: packages.yearly || null,
    lifetime: packages.lifetime || null,
  };
}

export async function openProPaywall(offering = null) {
  const result = await presentRevenueCatPaywall(offering);

  if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
    const subscription = await refreshSubscriptionStatus();
    return { result, subscription };
  }

  return { result, subscription: null };
}

export async function openProPaywallIfNeeded(offering = null) {
  const result = await presentRevenueCatPaywallIfNeeded(offering);

  if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
    const subscription = await refreshSubscriptionStatus();
    return { result, subscription };
  }

  return { result, subscription: null };
}

export async function openCustomerCenter() {
  await presentRevenueCatCustomerCenter();
  return await refreshSubscriptionStatus();
}

export function hasProAccess(subscription) {
  return ACTIVE_SUBSCRIPTION_STATUSES.has(subscription?.status);
}

export function getSubscriptionLabel(subscription) {
  const status = subscription?.status || "inactive";

  switch (status) {
    case "trialing":
      return "Free trial active";
    case "active":
      return "Pro active";
    case "grace_period":
      return "Billing issue";
    case "cancelled":
      return "Cancelled";
    case "expired":
      return "Expired";
    default:
      return "Not subscribed";
  }
}

export function getSubscriptionAccent(subscription) {
  const status = subscription?.status || "inactive";

  switch (status) {
    case "trialing":
      return { background: "#ECFDF5", text: "#047857", border: "#A7F3D0" };
    case "active":
      return { background: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" };
    case "grace_period":
      return { background: "#FFF7ED", text: "#C2410C", border: "#FED7AA" };
    case "cancelled":
    case "expired":
      return { background: "#FEF2F2", text: "#B91C1C", border: "#FECACA" };
    default:
      return { background: "#F8FAFC", text: "#334155", border: "#E2E8F0" };
  }
}

export function getSubscriptionDetailRows(subscription) {
  if (!subscription) return [];

  return [
    subscription?.productId ? { label: "Plan", value: subscription.productId } : null,
    subscription?.trialEndsAt ? { label: "Trial ends", value: new Date(subscription.trialEndsAt).toLocaleDateString() } : null,
    subscription?.expiresAt ? { label: "Renews / expires", value: new Date(subscription.expiresAt).toLocaleDateString() } : null,
    typeof subscription?.willRenew === "boolean" ? { label: "Auto-renew", value: subscription.willRenew ? "On" : "Off" } : null,
  ].filter(Boolean);
}

export function getFeatureAccess(subscription) {
  const pro = hasProAccess(subscription);

  return {
    [PRO_FEATURES.unlimitedProjects]: pro,
    [PRO_FEATURES.advancedFinance]: pro,
    [PRO_FEATURES.receiptExports]: pro,
    [PRO_FEATURES.employeeManagement]: pro,
    [PRO_FEATURES.aiQuotes]: pro,
  };
}
