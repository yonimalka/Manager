import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import SubscriptionCard from "./SubscriptionCard";
import {
  fetchProOffering,
  getSubscriptionDetailRows,
  hasProAccess,
  openCustomerCenter,
  openProPaywall,
  openProPaywallIfNeeded,
  purchaseProPackage,
  refreshSubscriptionStatus,
  restoreProSubscription,
} from "../services/subscription";

const premiumFeatures = [
  "Unlimited projects",
  "Advanced finance tools",
  "Receipt and income exports",
  "Employee management",
  "AI-powered quote generation",
];

function packageLabel(pkg, fallback) {
  if (!pkg) return fallback;
  return pkg?.product?.title || fallback;
}

function packagePrice(pkg) {
  return pkg?.product?.priceString || "Unavailable";
}

export default function SubscriptionScreen() {
  const navigation = useNavigation();
  const [subscription, setSubscription] = useState(null);
  const [offering, setOffering] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [paywallLoading, setPaywallLoading] = useState(false);
  const [customerCenterLoading, setCustomerCenterLoading] = useState(false);

  const loadSubscription = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const [subscriptionData, offeringData] = await Promise.all([
        refreshSubscriptionStatus(),
        fetchProOffering().catch((error) => {
          console.error("Failed to load offering:", error);
          return null;
        }),
      ]);

      setSubscription(subscriptionData);
      setOffering(offeringData);
    } catch (error) {
      console.error("Failed to load subscription:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  const active = hasProAccess(subscription);
  const detailRows = getSubscriptionDetailRows(subscription);

  const handlePackagePurchase = async (pkg) => {
    if (!pkg) {
      Alert.alert("Unavailable", "This package is not configured in RevenueCat yet.");
      return;
    }

    try {
      setPurchaseLoading(true);
      const result = await purchaseProPackage(pkg);

      if (result?.cancelled) {
        return;
      }

      setSubscription(result.subscription);
      Alert.alert(
        "Maggo Pro enabled",
        result.subscription?.status === "trialing"
          ? "Your free trial is active."
          : "Your Pro access is active."
      );
    } catch (error) {
      console.error("Package purchase failed:", error);
      Alert.alert(
        "Purchase failed",
        error?.message || "Could not complete the subscription purchase."
      );
    } finally {
      setPurchaseLoading(false);
    }
  };

  const handlePaywall = async () => {
    try {
      setPaywallLoading(true);
      const result = await openProPaywallIfNeeded(offering?.currentOffering || null);
      if (result?.subscription) {
        setSubscription(result.subscription);
      }
    } catch (error) {
      console.error("Paywall failed:", error);
      Alert.alert("Paywall failed", error?.message || "Could not open the paywall.");
    } finally {
      setPaywallLoading(false);
    }
  };

  const handleForcePaywall = async () => {
    try {
      setPaywallLoading(true);
      const result = await openProPaywall(offering?.currentOffering || null);
      if (result?.subscription) {
        setSubscription(result.subscription);
      }
    } catch (error) {
      console.error("Paywall failed:", error);
      Alert.alert("Paywall failed", error?.message || "Could not open the paywall.");
    } finally {
      setPaywallLoading(false);
    }
  };

  const handleRestore = async () => {
    try {
      setRestoreLoading(true);
      const result = await restoreProSubscription();
      setSubscription(result.subscription);

      if (hasProAccess(result.subscription)) {
        Alert.alert("Restored", "Your Maggo Pro access was restored successfully.");
      } else {
        Alert.alert("No subscription found", "We couldn't find an active Maggo Pro subscription to restore.");
      }
    } catch (error) {
      console.error("Restore failed:", error);
      Alert.alert("Restore failed", error?.message || "Could not restore purchases.");
    } finally {
      setRestoreLoading(false);
    }
  };

  const handleCustomerCenter = async () => {
    try {
      setCustomerCenterLoading(true);
      const updatedSubscription = await openCustomerCenter();
      setSubscription(updatedSubscription);
    } catch (error) {
      console.error("Customer center failed:", error);
      Alert.alert(
        "Customer Center unavailable",
        error?.message || "Could not open Customer Center on this device/build."
      );
    } finally {
      setCustomerCenterLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => loadSubscription(true)} />
      }
    >
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>

      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Maggo Pro</Text>
        <Text style={styles.heroSubtitle}>
          Monthly, yearly, and lifetime access powered by RevenueCat.
        </Text>
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <>
          <SubscriptionCard subscription={subscription} onPress={() => {}} />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Plans</Text>

            <TouchableOpacity
              style={[styles.planCard, purchaseLoading && styles.buttonDisabled]}
              disabled={purchaseLoading}
              onPress={() => handlePackagePurchase(offering?.monthly)}
            >
              <View>
                <Text style={styles.planTitle}>{packageLabel(offering?.monthly, "Monthly")}</Text>
                <Text style={styles.planCaption}>30-day trial if configured in the store</Text>
              </View>
              <Text style={styles.planPrice}>{packagePrice(offering?.monthly)}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.planCard, purchaseLoading && styles.buttonDisabled]}
              disabled={purchaseLoading}
              onPress={() => handlePackagePurchase(offering?.yearly)}
            >
              <View>
                <Text style={styles.planTitle}>{packageLabel(offering?.yearly, "Yearly")}</Text>
                <Text style={styles.planCaption}>Best for annual subscribers</Text>
              </View>
              <Text style={styles.planPrice}>{packagePrice(offering?.yearly)}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.planCard, purchaseLoading && styles.buttonDisabled]}
              disabled={purchaseLoading}
              onPress={() => handlePackagePurchase(offering?.lifetime)}
            >
              <View>
                <Text style={styles.planTitle}>{packageLabel(offering?.lifetime, "Lifetime")}</Text>
                <Text style={styles.planCaption}>One-time unlock</Text>
              </View>
              <Text style={styles.planPrice}>{packagePrice(offering?.lifetime)}</Text>
            </TouchableOpacity>
          </View>

          {!!detailRows.length && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Subscription details</Text>
              {detailRows.map((row) => (
                <View key={row.label} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{row.label}</Text>
                  <Text style={styles.detailValue}>{row.value}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Premium features</Text>
            {premiumFeatures.map((feature) => (
              <View key={feature} style={styles.featureRow}>
                <Ionicons
                  name={active ? "checkmark-circle" : "ellipse-outline"}
                  size={18}
                  color={active ? "#16A34A" : "#64748B"}
                />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, paywallLoading && styles.buttonDisabled]}
            onPress={handlePaywall}
            disabled={paywallLoading}
          >
            {paywallLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Open RevenueCat paywall</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, paywallLoading && styles.buttonDisabled]}
            onPress={handleForcePaywall}
            disabled={paywallLoading}
          >
            <Text style={styles.secondaryButtonText}>Force paywall</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, restoreLoading && styles.buttonDisabled]}
            onPress={handleRestore}
            disabled={restoreLoading}
          >
            {restoreLoading ? (
              <ActivityIndicator color="#2563EB" />
            ) : (
              <Text style={styles.secondaryButtonText}>Restore purchases</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, customerCenterLoading && styles.buttonDisabled]}
            onPress={handleCustomerCenter}
            disabled={customerCenterLoading}
          >
            {customerCenterLoading ? (
              <ActivityIndicator color="#2563EB" />
            ) : (
              <Text style={styles.secondaryButtonText}>Open Customer Center</Text>
            )}
          </TouchableOpacity>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Setup note</Text>
            <Text style={styles.sectionText}>
              The trial, products, offering, paywall, and Customer Center configuration all come from RevenueCat and the app stores. This screen now consumes those remote configs directly.
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  content: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
    gap: 18,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
  },
  hero: {
    backgroundColor: "#2563EB",
    borderRadius: 24,
    padding: 22,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: "#DBEAFE",
  },
  loaderWrap: {
    paddingVertical: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 10,
  },
  sectionText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#475569",
  },
  planCard: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  planTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 4,
  },
  planCaption: {
    fontSize: 13,
    color: "#64748B",
  },
  planPrice: {
    fontSize: 15,
    fontWeight: "700",
    color: "#2563EB",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 10,
  },
  detailLabel: {
    fontSize: 14,
    color: "#64748B",
  },
  detailValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  featureText: {
    fontSize: 14,
    color: "#334155",
  },
  primaryButton: {
    backgroundColor: "#2563EB",
    borderRadius: 18,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 18,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "#2563EB",
    fontSize: 16,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
