import Purchases, { LOG_LEVEL, PURCHASES_ERROR_CODE } from "react-native-purchases";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";
import { Platform } from "react-native";

const IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
// const ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
const PRO_ENTITLEMENT = process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID || "pro";

let purchasesConfigured = false;

function getApiKey() {
  return  IOS_API_KEY;
}

function findPackageByIdentifier(offering, identifier) {
  if (!offering) return null;

  const packages = Array.isArray(offering.availablePackages) ? offering.availablePackages : [];

  const byIdentifier = packages.find((pkg) => pkg?.identifier === identifier);
  if (byIdentifier) return byIdentifier;

  const normalizedIdentifier = String(identifier || "").toLowerCase();
  return (
    packages.find((pkg) => {
      const productId = String(pkg?.product?.identifier || "").toLowerCase();
      const packageType = String(pkg?.packageType || "").toLowerCase();
      return productId.includes(normalizedIdentifier) || packageType.includes(normalizedIdentifier);
    }) || null
  );
}

function getOfferingPackages(offering) {
  return {
    monthly: offering?.monthly || findPackageByIdentifier(offering, "monthly"),
    yearly:
      offering?.annual ||
      findPackageByIdentifier(offering, "yearly") ||
      findPackageByIdentifier(offering, "annual"),
    lifetime: offering?.lifetime || findPackageByIdentifier(offering, "lifetime"),
  };
}

export async function configureRevenueCat(appUserId) {
  const apiKey = getApiKey();

  console.log("[RC] apiKey:", apiKey);
  console.log("[RC] appUserId:", appUserId);

  if (!apiKey || !appUserId) {
    console.warn("[RC] Missing apiKey or appUserId — aborting");
    return { configured: false };
  }

  try {
    Purchases.setLogLevel(LOG_LEVEL.WARN);

    if (!purchasesConfigured) {
      await Purchases.configure({ apiKey, appUserID: appUserId });
      purchasesConfigured = true;
    } else {
      await Purchases.logIn(appUserId);
    }

    console.log("[RC] Configured successfully");
    return { configured: true };
  } catch (err) {
    console.error("[RC] ERROR:", err.code, err.message);
    return { configured: false, error: err.message };
  }
}

export async function getRevenueCatCustomerInfo() {
  if (!purchasesConfigured) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch (error) {
    console.error("RevenueCat customer info error:", error);
    return null;
  }
}

export async function getRevenueCatOfferings() {
  if (!purchasesConfigured) return null;
  try {
    return await Purchases.getOfferings();
  } catch (error) {
    console.error("RevenueCat offerings error:", error);
    throw error;
  }
}

export async function getRevenueCatPackages() {
  const offerings = await getRevenueCatOfferings();
  const currentOffering = offerings?.current || null;
  const packages = getOfferingPackages(currentOffering);

  return {
    offerings,
    currentOffering,
    packages,
    entitlementId: PRO_ENTITLEMENT,
  };
}

export async function purchaseRevenueCatPackage(selectedPackage) {
  if (!purchasesConfigured) throw new Error("RevenueCat is not configured yet.");
  try {
    if (!selectedPackage) {
      throw new Error("Selected RevenueCat package is missing");
    }

    const purchaseResult = await Purchases.purchasePackage(selectedPackage);

    return {
      ...purchaseResult,
      entitlementId: PRO_ENTITLEMENT,
      productId: selectedPackage?.product?.identifier || null,
      storeProduct: selectedPackage?.product || null,
      selectedPackage,
    };
  } catch (error) {
    if (
      error?.userCancelled ||
      error?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
    ) {
      return { cancelled: true };
    }

    console.error("RevenueCat purchase error:", error);
    throw error;
  }
}

export async function presentRevenueCatPaywallIfNeeded(offering = null) {
  if (!purchasesConfigured) throw new Error("RevenueCat is not configured yet.");
  return await RevenueCatUI.presentPaywallIfNeeded({
    requiredEntitlementIdentifier: PRO_ENTITLEMENT,
    offering: offering || undefined,
    displayCloseButton: true,
  });
}

export async function presentRevenueCatPaywall(offering = null) {
  if (!purchasesConfigured) throw new Error("RevenueCat is not configured yet.");
  return await RevenueCatUI.presentPaywall({
    offering: offering || undefined,
    displayCloseButton: true,
  });
}

export async function presentRevenueCatCustomerCenter() {
  if (!purchasesConfigured) throw new Error("RevenueCat is not configured yet.");
  return await RevenueCatUI.presentCustomerCenter();
}

export function isRevenueCatConfigured() {
  return purchasesConfigured;
}

export async function restoreRevenueCatPurchases() {
  if (!purchasesConfigured) throw new Error("RevenueCat is not configured yet.");
  try {
    return await Purchases.restorePurchases();
  } catch (error) {
    console.error("RevenueCat restore error:", error);
    throw error;
  }
}

export function getEntitlementState(customerInfo, entitlementId = PRO_ENTITLEMENT) {
  const entitlement = customerInfo?.entitlements?.active?.[entitlementId] || null;
  const productId = entitlement?.productIdentifier || null;
  const willRenew = !!entitlement?.willRenew;
  const latestExpirationDate = entitlement?.expirationDate || null;
  const latestPurchaseDate = entitlement?.latestPurchaseDate || null;
  const periodType = String(entitlement?.periodType || "").toLowerCase();

  const status = entitlement
    ? periodType === "trial"
      ? "trialing"
      : "active"
    : "inactive";

  return {
    entitlementId,
    productId,
    status,
    trialEndsAt: periodType === "trial" ? latestExpirationDate : null,
    expiresAt: latestExpirationDate,
    willRenew,
    latestPurchaseDate,
    hasAccess: !!entitlement,
    rawEntitlement: entitlement,
  };
}

export { PAYWALL_RESULT };
