import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  TextInput,
  Linking,
  Platform,
  ActionSheetIOS,
  useWindowDimensions,
  Switch,
  Pressable,
  DeviceEventEmitter,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Reanimated, {
  useAnimatedStyle,
  interpolate,
  useAnimatedReaction,
  useSharedValue,
  runOnJS,
} from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../services/api";
import { formatCurrency } from "../services/formatCurrency";
import { track } from "../utils/analytics";
import BottomSheet from "./BottomSheet";
import { useUndoToast } from "./UndoToast";
import { hasAnyPaymentMethod } from "../utils/paymentMethods";

// ─── Phone helpers ──────────────────────────────────────────────────────────

const COUNTRY_CODES = { US: "1", CA: "1", GB: "44", IL: "972", AU: "61", IE: "353" };

export const toIntl = (raw, region) => {
  if (!raw) return "";
  let s = String(raw).trim();
  if (s.startsWith("+")) return s.replace(/\D/g, "");
  let d = s.replace(/\D/g, "");
  if (d.startsWith("00")) return d.slice(2);
  const cc = COUNTRY_CODES[region];
  if (!cc) return d;
  if ((region === "US" || region === "CA") && d.length === 10) return "1" + d;
  if (d.startsWith("0")) return cc + d.slice(1);
  return d;
};

// ─── Date helpers ────────────────────────────────────────────────────────────

const calcDayDiff = (dueDate) => {
  const now = new Date();
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(dueDate);
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  return Math.round((dueDay - nowDay) / (1000 * 60 * 60 * 24));
};

const isRemindedToday = (inv) => {
  if (!inv.lastRemindedAt) return false;
  const today = new Date();
  const d = new Date(inv.lastRemindedAt);
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
};

const calcRemDaysAgo = (lastRemindedAt) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(lastRemindedAt);
  d.setHours(0, 0, 0, 0);
  return Math.round((today - d) / 86400000);
};

const relativeTime = (date) => {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  const d = Math.floor(diff / 86400);
  return `${d} day${d !== 1 ? "s" : ""} ago`;
};

const methodLabel = (method) => {
  if (!method) return "";
  const map = { paypalMe: "PayPal", venmo: "Venmo", cashApp: "Cash App", zelle: "Zelle", bank: "bank transfer" };
  return map[method] ? ` via ${map[method]}` : "";
};

const getMethodNames = (pm) => {
  if (!pm) return "";
  const names = [];
  if (pm.paypalMe) names.push("PayPal");
  if (pm.venmo)    names.push("Venmo");
  if (pm.cashApp)  names.push("Cash App");
  if (pm.zelle)    names.push("Zelle");
  if (pm.bank)     names.push("Bank");
  return names.join(", ");
};

const PAY_BASE = "https://pay.maggoapp.com";

// ─── Swipe action panel ───────────────────────────────────────────────────────

function RightAction({ prog, onDelete, onFullSwipe, screenWidth }) {
  const fired = useSharedValue(false);

  useAnimatedReaction(
    () => prog.value,
    (val) => {
      if (val > (screenWidth * 0.7) / 88 && !fired.value) {
        fired.value = true;
        runOnJS(onFullSwipe)();
      }
    }
  );

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(prog.value, [0, 0.5], [0, 1], "clamp"),
  }));

  return (
    <Reanimated.View
      style={[
        { width: 88, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center" },
        fadeStyle,
      ]}
    >
      <TouchableOpacity
        style={{ alignItems: "center", justifyContent: "center", flex: 1, width: "100%" }}
        onPress={onDelete}
      >
        <Ionicons name="trash-outline" size={20} color="#fff" />
        <Text style={{ fontSize: 12, fontWeight: "600", color: "#fff", marginTop: 3 }}>Delete</Text>
      </TouchableOpacity>
    </Reanimated.View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OwedSection({
  summary,
  currency,
  locale,
  userName,
  region: regionProp,
  onAdd,
  onChanged,
  paymentMethods,
  pendingClaimId,
  onClaimHandled,
  userId,
  firstRunVisible,
}) {
  const region = regionProp || locale.split("-")[1] || "US";
  const { width: screenWidth } = useWindowDimensions();
  const { showUndo } = useUndoToast();
  const navigation = useNavigation();

  // Remind sheet
  const [remindSheetVisible, setRemindSheetVisible] = useState(false);
  const [remindInvoice, setRemindInvoice] = useState(null);
  const [remindedIds, setRemindedIds] = useState({});
  const [remindPhone, setRemindPhone] = useState("");
  const remindPhoneRef = useRef(null);

  // Pay link
  const [includePayLink, setIncludePayLink] = useState(true);
  const [payLinkUrl, setPayLinkUrl] = useState(null);
  const [payLinkLoading, setPayLinkLoading] = useState(false);

  // Claim sheet (§3)
  const [claimSheetVisible, setClaimSheetVisible] = useState(false);
  const [claimInvoice, setClaimInvoice] = useState(null);

  // Swipe-to-delete
  const [pendingDeleteIds, setPendingDeleteIds] = useState({});
  const openSwipeableRef = useRef(null);

  // Pay-link nudge card (board 8)
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const nudgeShownRef = useRef(false);
  const [localPm, setLocalPm] = useState(paymentMethods ?? {});

  // Load persisted pay link preference
  useEffect(() => {
    AsyncStorage.getItem("maggo_include_pay_link").then((v) => {
      if (v !== null) setIncludePayLink(v === "true");
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!userId) return;
    AsyncStorage.getItem(`maggo_paylink_nudge_dismissed_${userId}`)
      .then((v) => { if (v === "1") setNudgeDismissed(true); })
      .catch(() => {});
  }, [userId]);

  useEffect(() => { setLocalPm(paymentMethods ?? {}); }, [paymentMethods]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("maggo:paymethods-updated", (pm) => {
      setLocalPm(pm ?? {});
    });
    return () => sub.remove();
  }, []);

  const saveIncludePayLink = (val) => {
    setIncludePayLink(val);
    AsyncStorage.setItem("maggo_include_pay_link", String(val)).catch(() => {});
  };

  const dismissNudge = () => {
    setNudgeDismissed(true);
    if (userId) AsyncStorage.setItem(`maggo_paylink_nudge_dismissed_${userId}`, "1").catch(() => {});
    track("paylink_nudge_dismissed");
  };

  // Open claim sheet from notification (§4)
  useEffect(() => {
    if (!pendingClaimId || !summary?.items) return;
    const inv = summary.items.find((i) => i._id === pendingClaimId);
    if (inv?.claimedAt) {
      setClaimInvoice(inv);
      setClaimSheetVisible(true);
    }
    onClaimHandled?.();
  }, [pendingClaimId, summary]);

  const startDelete = useCallback(
    (inv, method) => {
      if (openSwipeableRef.current) {
        openSwipeableRef.current.close();
        openSwipeableRef.current = null;
      }
      setPendingDeleteIds((prev) => ({ ...prev, [inv._id]: true }));
      showUndo({
        message: `${inv.client} deleted`,
        commit: async () => {
          try {
            await api.delete(`/invoices/${inv._id}`);
            track("owed_deleted", { method, undone: false });
          } catch (e) {
            if (e?.response?.status !== 404) {
              Alert.alert("Couldn't delete", "Please try again.");
            }
          } finally {
            onChanged?.();
          }
        },
        onUndo: () => {
          setPendingDeleteIds((prev) => {
            const next = { ...prev };
            delete next[inv._id];
            return next;
          });
          track("owed_delete_undone");
        },
      });
    },
    [showUndo, onChanged]
  );

  const handleMarkPaid = useCallback(
    (invoice) => {
      if (openSwipeableRef.current) {
        openSwipeableRef.current.close();
        openSwipeableRef.current = null;
      }
      Alert.alert(
        "Mark as paid?",
        `${formatCurrency(invoice.amount, currency, locale)} from ${invoice.client} will be added to this month's income.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Yes, mark paid",
            onPress: async () => {
              try {
                await api.patch(`/invoices/${invoice._id}/pay`);
                track("owed_marked_paid", { amount: invoice.amount });
                await onChanged();
              } catch (e) {
                if (e.response?.status === 409) {
                  await onChanged();
                } else {
                  Alert.alert("Error", "Could not mark as paid. Please try again.");
                }
              }
            },
          },
        ]
      );
    },
    [currency, locale, onChanged]
  );

  const handleOpenRemind = useCallback((invoice) => {
    if (openSwipeableRef.current) {
      openSwipeableRef.current.close();
      openSwipeableRef.current = null;
    }
    setRemindInvoice(invoice);
    setRemindPhone(invoice.clientPhone || "");
    setPayLinkUrl(null);
    setRemindSheetVisible(true);
    // Load pay link URL
    setPayLinkLoading(true);
    if (invoice.publicToken) {
      setPayLinkUrl(`${PAY_BASE}/${invoice.publicToken}`);
      setPayLinkLoading(false);
    } else {
      api.get(`/invoices/${invoice._id}/link`)
        .then((res) => setPayLinkUrl(res.data.url))
        .catch(() => {})
        .finally(() => setPayLinkLoading(false));
    }
  }, []);

  const openClaimSheet = useCallback((invoice) => {
    if (openSwipeableRef.current) {
      openSwipeableRef.current.close();
      openSwipeableRef.current = null;
    }
    setClaimInvoice(invoice);
    setClaimSheetVisible(true);
  }, []);

  const markReminded = async (invoice, channel) => {
    setRemindedIds((prev) => ({ ...prev, [invoice._id]: true }));
    try {
      await api.patch(`/invoices/${invoice._id}/remind`);
      track("owed_reminder_sent", { amount: invoice.amount, channel });
    } catch (e) {}
  };

  const savePhone = async (invoiceId, phone) => {
    try {
      await api.patch(`/invoices/${invoiceId}`, { clientPhone: phone });
      onChanged();
    } catch (e) {}
  };

  const getRemindMessage = (invoice, payUrl = null) => {
    if (!invoice) return "";
    const clientFirst = (invoice.client || "there").trim().split(/\s+/)[0];
    const userFirst = (userName || "").trim().split(/\s+/)[0] || "me";
    const amt = formatCurrency(invoice.amount || 0, currency, locale);
    const days = calcDayDiff(invoice.dueDate);
    let body;
    if (days < 0) {
      const n = Math.abs(days);
      body = `Hi ${clientFirst}, a quick reminder about the ${amt} payment for the job I did for you. It was due ${n} day${n !== 1 ? "s" : ""} ago. Could you take care of it this week?`;
    } else if (days === 0) {
      body = `Hi ${clientFirst}, just a reminder that the ${amt} payment is due today.`;
    } else {
      body = `Hi ${clientFirst}, a friendly heads-up that the ${amt} payment is due in ${days} day${days !== 1 ? "s" : ""}.`;
    }
    const payPart = payUrl ? ` You can pay here: ${payUrl}` : "";
    return `${body}${payPart} Thanks, ${userFirst}`;
  };

  const handleLongPress = useCallback(
    (inv) => {
      if (Platform.OS === "ios") {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: inv.claimedAt
              ? ["Cancel", "Confirm payment", "Remind", "Mark paid", "Delete"]
              : ["Cancel", "Remind", "Mark paid", "Delete"],
            destructiveButtonIndex: inv.claimedAt ? 4 : 3,
            cancelButtonIndex: 0,
          },
          (idx) => {
            if (inv.claimedAt) {
              if (idx === 1) openClaimSheet(inv);
              else if (idx === 2) handleOpenRemind(inv);
              else if (idx === 3) handleMarkPaid(inv);
              else if (idx === 4) startDelete(inv, "long_press");
            } else {
              if (idx === 1) handleOpenRemind(inv);
              else if (idx === 2) handleMarkPaid(inv);
              else if (idx === 3) startDelete(inv, "long_press");
            }
          }
        );
      } else {
        const buttons = inv.claimedAt
          ? [
              { text: "Confirm payment", onPress: () => openClaimSheet(inv) },
              { text: "Remind", onPress: () => handleOpenRemind(inv) },
              { text: "Mark paid", onPress: () => handleMarkPaid(inv) },
              { text: "Delete", style: "destructive", onPress: () => startDelete(inv, "long_press") },
              { text: "Cancel", style: "cancel" },
            ]
          : [
              { text: "Remind", onPress: () => handleOpenRemind(inv) },
              { text: "Mark paid", onPress: () => handleMarkPaid(inv) },
              { text: "Delete", style: "destructive", onPress: () => startDelete(inv, "long_press") },
              { text: "Cancel", style: "cancel" },
            ];
        Alert.alert(inv.client, undefined, buttons);
      }
    },
    [handleOpenRemind, handleMarkPaid, startDelete, openClaimSheet]
  );

  const handleConfirmClaim = async (invoice) => {
    setClaimSheetVisible(false);
    try {
      await api.patch(`/invoices/${invoice._id}/pay`);
      track("claim_confirmed", { amount: invoice.amount });
      await onChanged();
    } catch (e) {
      if (e.response?.status === 409) {
        await onChanged();
      } else {
        Alert.alert("Error", "Could not mark as paid. Please try again.");
      }
    }
  };

  const handleRejectClaim = async (invoice) => {
    setClaimSheetVisible(false);
    try {
      await api.patch(`/invoices/${invoice._id}/unclaim`);
      track("claim_rejected", { amount: invoice.amount });
      await onChanged();
    } catch {
      Alert.alert("Error", "Could not update. Please try again.");
    }
  };

  // Executes the actual WA/SMS send after all checks pass
  const executeSend = async (channel, invoice, phone, payUrl) => {
    const msg = getRemindMessage(invoice, payUrl);
    const rawPhone = invoice?.clientPhone || phone.trim();
    let url;
    if (channel === "whatsapp") {
      const intlPhone = toIntl(rawPhone, region);
      const encoded = encodeURIComponent(msg);
      url = intlPhone ? `https://wa.me/${intlPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    } else {
      const intlPhone = rawPhone ? "+" + toIntl(rawPhone, region) : "";
      const encoded = encodeURIComponent(msg);
      url = Platform.OS === "ios" ? `sms:${intlPhone}&body=${encoded}` : `sms:${intlPhone}?body=${encoded}`;
    }
    try {
      await Linking.openURL(url);
      if (!invoice?.clientPhone && phone.trim()) savePhone(invoice._id, phone.trim());
      await markReminded(invoice, channel);
      setRemindSheetVisible(false);
    } catch {
      Alert.alert(
        channel === "whatsapp" ? "Couldn't open WhatsApp" : "Couldn't open Messages",
        "Make sure it's installed, or try the other option."
      );
    }
  };

  const doSend = async (channel) => {
    const effectiveUrl = includePayLink ? payLinkUrl : null;
    track("pay_link_included", { included: !!effectiveUrl });
    await executeSend(channel, remindInvoice, remindPhone, effectiveUrl);
  };

  // Derived display values — exclude pending-deleted rows
  const visibleItems = summary.items.filter((inv) => !pendingDeleteIds[inv._id]);
  const pendingAmount = summary.items
    .filter((inv) => pendingDeleteIds[inv._id])
    .reduce((sum, inv) => sum + inv.amount, 0);
  const pendingLate = summary.items.filter(
    (inv) => pendingDeleteIds[inv._id] && calcDayDiff(inv.dueDate) < 0
  ).length;
  const displayTotal = summary.totalOwed - pendingAmount;
  const displayOverdue = summary.overdueCount - pendingLate;

  // Composition bar segments (excludes pending-deleted rows)
  const lateAmt = visibleItems
    .filter((inv) => calcDayDiff(inv.dueDate) < 0)
    .reduce((s, inv) => s + inv.amount, 0);
  const soonAmt = visibleItems
    .filter((inv) => { const d = calcDayDiff(inv.dueDate); return d >= 0 && d <= 3; })
    .reduce((s, inv) => s + inv.amount, 0);
  const onTrackAmt = visibleItems
    .filter((inv) => calcDayDiff(inv.dueDate) > 3)
    .reduce((s, inv) => s + inv.amount, 0);
  const barSegments = [
    { key: "late", amount: lateAmt, color: "#EF4444", label: "late" },
    { key: "soon", amount: soonAmt, color: "#F59E0B", label: "due soon" },
    { key: "ontrack", amount: onTrackAmt, color: "#3B82F6", label: "on track" },
  ].filter((seg) => seg.amount > 0);
  const showCompositionBar = barSegments.length > 1;

  // Nudge card visibility
  const showNudge =
    visibleItems.length > 0 &&
    !hasAnyPaymentMethod(localPm) &&
    !nudgeDismissed &&
    !firstRunVisible;

  // Track nudge shown once per session
  useEffect(() => {
    if (showNudge && !nudgeShownRef.current) {
      nudgeShownRef.current = true;
      track("paylink_nudge_shown");
    }
  }, [showNudge]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View>
      {/* Header */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#0F172A", letterSpacing: -0.3 }}>Owed to You</Text>
        <TouchableOpacity
          style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: "#EFF6FF" }}
          onPress={onAdd}
        >
          <Text style={{ fontSize: 12, fontWeight: "600", color: "#2563EB" }}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {visibleItems.length === 0 && Object.keys(pendingDeleteIds).length === 0 ? (
        /* Empty state */
        <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 28, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
            <Ionicons name="checkmark" size={20} color="#059669" />
          </View>
          <Text style={{ fontSize: 15, fontWeight: "600", color: "#0F172A", marginBottom: 6 }}>No one owes you right now</Text>
          <Text style={{ fontSize: 13, color: "#64748B", textAlign: "center", lineHeight: 20 }}>
            {'When a client will pay later, log it as "Not yet" and it waits here until they do.'}
          </Text>
        </View>
      ) : visibleItems.length > 0 ? (
        <>
          {/* Summary card */}
          <View style={{
            backgroundColor: "#fff",
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            borderBottomLeftRadius: showNudge ? 16 : 0,
            borderBottomRightRadius: showNudge ? 16 : 0,
            overflow: "hidden",
            shadowColor: "#000",
            shadowOpacity: 0.06,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
            elevation: 2,
            marginBottom: showNudge ? 12 : 0,
          }}>
            <View style={{ padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View>
                <Text style={{ fontSize: 26, fontWeight: "800", color: "#0F172A", letterSpacing: -0.8 }}>
                  {formatCurrency(displayTotal, currency, locale)}
                </Text>
                <Text style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>
                  {`from ${visibleItems.length} client${visibleItems.length !== 1 ? "s" : ""}`}
                </Text>
              </View>
              {displayOverdue > 0 && (
                <View style={{ backgroundColor: "#FEF2F2", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#DC2626" }}>{displayOverdue} late</Text>
                </View>
              )}
            </View>

            {showCompositionBar && (
              <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
                <View style={{ flexDirection: "row", gap: 2, height: 6, borderRadius: 3, backgroundColor: "#F1F5F9", overflow: "hidden" }}>
                  {barSegments.map((seg) => (
                    <View key={seg.key} style={{ flex: seg.amount, height: 6, backgroundColor: seg.color }} />
                  ))}
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 8 }}>
                  {barSegments.map((seg) => (
                    <View key={seg.key} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: seg.color }} />
                      <Text style={{ fontSize: 12, color: "#475569" }}>
                        <Text style={{ fontWeight: "700", color: "#0F172A" }}>{formatCurrency(seg.amount, currency, locale)}</Text>
                        {" " + seg.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* Pay-link nudge card */}
          {showNudge && (
            <View style={{
              backgroundColor: "#FFFFFF",
              borderWidth: 1,
              borderColor: "#A7F3D0",
              borderRadius: 20,
              padding: 16,
              marginBottom: 12,
            }}>
              <TouchableOpacity
                onPress={dismissNudge}
                hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                style={{ position: "absolute", top: 0, right: 0, width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="close" size={16} color="#047857" />
              </TouchableOpacity>

              <View style={{ flexDirection: "row", gap: 14, alignItems: "flex-start" }}>
                <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Ionicons name="link-outline" size={20} color="#047857" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: "#0F172A", marginBottom: 6 }}>
                    Let clients pay from the reminder
                  </Text>
                  <Text style={{ fontSize: 14, color: "#475569", lineHeight: 20, marginBottom: 12 }}>
                    Add PayPal, Venmo or bank once. Every reminder carries a pay link and you're notified when they pay.
                  </Text>
                  <TouchableOpacity
                    style={{ height: 48, borderRadius: 14, backgroundColor: "#0F172A", alignItems: "center", justifyContent: "center" }}
                    onPress={() => {
                      track("paylink_nudge_tapped");
                      navigation.navigate("PaymentMethods");
                    }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: "700", color: "#FFFFFF" }}>Add how clients pay you</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Invoice list card */}
          <View style={{
            backgroundColor: "#fff",
            borderTopLeftRadius: showNudge ? 16 : 0,
            borderTopRightRadius: showNudge ? 16 : 0,
            borderBottomLeftRadius: 16,
            borderBottomRightRadius: 16,
            overflow: "hidden",
            shadowColor: "#000",
            shadowOpacity: showNudge ? 0.06 : 0,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
            elevation: showNudge ? 2 : 0,
          }}>
          {/* Divider */}
          <View style={{ height: 1, backgroundColor: "#F1F5F9" }} />

          {/* Invoice rows */}
          {visibleItems.map((inv, rowIndex) => {
            const days = calcDayDiff(inv.dueDate);
            const isLate = days < 0;
            const isToday = days === 0;
            const isSoon = days >= 1 && days <= 3;
            const reminded = !!remindedIds[inv._id] || isRemindedToday(inv);

            const words = (inv.client || "?").trim().split(/\s+/);
            const initials =
              words.length >= 2
                ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
                : words[0][0].toUpperCase();
            const circleBg = isLate ? "#FEF2F2" : isToday || isSoon ? "#FFFBEB" : "#EFF6FF";
            const circleText = isLate ? "#DC2626" : isToday || isSoon ? "#B45309" : "#2563EB";

            let statusLabel, statusColor, statusWeight;
            if (isLate) {
              const n = Math.abs(days);
              statusLabel = `${n} day${n !== 1 ? "s" : ""} late`;
              statusColor = "#DC2626"; statusWeight = "600";
            } else if (isToday) {
              statusLabel = "Due today"; statusColor = "#B45309"; statusWeight = "600";
            } else if (days === 1) {
              statusLabel = "Due tomorrow"; statusColor = "#B45309"; statusWeight = "600";
            } else if (isSoon) {
              statusLabel = `Due in ${days} days`; statusColor = "#B45309"; statusWeight = "600";
            } else {
              statusLabel = `Due in ${days} days`; statusColor = "#2563EB"; statusWeight = "500";
            }

            const showRemindedAgo = inv.lastRemindedAt && !isRemindedToday(inv);
            const remDaysAgo = showRemindedAgo ? calcRemDaysAgo(inv.lastRemindedAt) : 0;

            let barPct;
            if (days <= 0) {
              barPct = 1;
            } else {
              const nowMs = Date.now();
              const createdMs = new Date(inv.createdAt).getTime();
              const dueMs = new Date(inv.dueDate).getTime();
              const total = dueMs - createdMs;
              barPct = total > 0 ? Math.max(0.06, Math.min(0.99, (nowMs - createdMs) / total)) : 0.06;
            }
            const barColor = isLate ? "#EF4444" : isToday || isSoon ? "#F59E0B" : "#3B82F6";

            let remBg, remBorderW, remBorderC, remTxt, remLabel;
            if (reminded) {
              remBg = "#F8FAFC"; remBorderW = 0; remBorderC = "transparent"; remTxt = "#94A3B8"; remLabel = "Sent";
            } else if (isLate) {
              remBg = "#FEF2F2"; remBorderW = 0; remBorderC = "transparent"; remTxt = "#DC2626"; remLabel = "Remind";
            } else {
              remBg = "#fff"; remBorderW = 1; remBorderC = "#E2E8F0"; remTxt = "#334155"; remLabel = "Remind";
            }

            const isClaimed = !!inv.claimedAt;

            return (
              <ReanimatedSwipeable
                key={inv._id}
                friction={2}
                rightThreshold={40}
                overshootRight={false}
                renderRightActions={(prog) => (
                  <RightAction
                    prog={prog}
                    onDelete={() => startDelete(inv, "swipe")}
                    onFullSwipe={() => startDelete(inv, "full_swipe")}
                    screenWidth={screenWidth}
                  />
                )}
                onSwipeableWillOpen={() => {
                  if (openSwipeableRef.current) {
                    openSwipeableRef.current.close();
                    openSwipeableRef.current = null;
                  }
                }}
                onSwipeableOpen={(dir, swipeable) => {
                  openSwipeableRef.current = swipeable;
                }}
                onSwipeableClose={() => {
                  openSwipeableRef.current = null;
                }}
                containerStyle={{ borderTopWidth: rowIndex === 0 ? 0 : 1, borderTopColor: "#F1F5F9" }}
                accessibilityActions={[{ name: "delete", label: "Delete" }]}
                onAccessibilityAction={(e) => {
                  if (e.nativeEvent.actionName === "delete") startDelete(inv, "swipe");
                }}
              >
                <TouchableOpacity
                  activeOpacity={isClaimed ? 0.7 : 1}
                  delayLongPress={350}
                  onPress={isClaimed ? () => openClaimSheet(inv) : undefined}
                  onLongPress={() => handleLongPress(inv)}
                  style={{ flexDirection: "row", backgroundColor: "#fff" }}
                >
                  {isLate && <View style={{ width: 3, backgroundColor: "#EF4444" }} />}
                  <View style={{ flex: 1, paddingTop: 14, paddingBottom: 14, paddingLeft: isLate ? 13 : 16, paddingRight: 16 }}>
                    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: circleBg, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Text style={{ fontSize: 13, fontWeight: "700", color: circleText }}>{initials}</Text>
                      </View>
                      <View style={{ flex: 1, flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                        <View style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
                          <Text numberOfLines={1} style={{ fontSize: 16, lineHeight: 20, fontWeight: "600", color: "#0F172A" }}>{inv.client}</Text>
                          <Text style={{ fontSize: 13, lineHeight: 17, marginTop: 7, fontWeight: statusWeight, color: statusColor }}>
                            {statusLabel}
                            {showRemindedAgo && (
                              <Text style={{ fontWeight: "400" }}>{` · reminded ${remDaysAgo}d ago`}</Text>
                            )}
                          </Text>
                          {isClaimed && (
                            <TouchableOpacity
                              onPress={() => openClaimSheet(inv)}
                              style={{ alignSelf: "flex-start", marginTop: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: "#ECFDF5" }}
                            >
                              <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "600", color: "#047857" }}>Says paid ›</Text>
                            </TouchableOpacity>
                          )}
                          <View style={{ width: 88, height: 4, marginTop: 7, borderRadius: 2, backgroundColor: "#F1F5F9", overflow: "hidden" }}>
                            <View style={{ width: Math.round(barPct * 88), height: 4, borderRadius: 2, backgroundColor: barColor }} />
                          </View>
                        </View>
                        <View style={{ alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                          <Text style={{ fontSize: 16, lineHeight: 20, fontWeight: "700", color: "#0F172A" }}>
                            {formatCurrency(inv.amount, currency, locale)}
                          </Text>
                          <View style={{ flexDirection: "row", gap: 6 }}>
                            <TouchableOpacity
                              onPress={() => handleOpenRemind(inv)}
                              style={{ minHeight: 32, paddingHorizontal: 11, borderRadius: 10, backgroundColor: remBg, borderWidth: remBorderW, borderColor: remBorderC, flexDirection: "row", alignItems: "center", gap: 5 }}
                            >
                              <Ionicons name="chatbubble-outline" size={13} color={remTxt} />
                              <Text style={{ fontSize: 13, fontWeight: "600", color: remTxt }}>{remLabel}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleMarkPaid(inv)}
                              style={{ minHeight: 32, paddingHorizontal: 11, borderRadius: 10, backgroundColor: "#ECFDF5", flexDirection: "row", alignItems: "center", gap: 5 }}
                            >
                              <Ionicons name="checkmark" size={13} color="#059669" />
                              <Text style={{ fontSize: 13, fontWeight: "700", color: "#059669" }}>Paid</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              </ReanimatedSwipeable>
            );
          })}
          </View>
        </>
      ) : null}

      {/* Remind sheet */}
      <BottomSheet visible={remindSheetVisible} onClose={() => setRemindSheetVisible(false)}>
        <Text style={{ fontSize: 17, fontWeight: "700", color: "#0F172A", marginBottom: 4 }}>Send Reminder</Text>

        {remindInvoice?.clientPhone ? (
          <Text style={{ fontSize: 13, color: "#64748B", marginBottom: 22 }}>
            To {remindInvoice.client} · {remindInvoice.clientPhone}
          </Text>
        ) : (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: "#64748B", marginBottom: 6 }}>
              Add {remindInvoice ? remindInvoice.client.trim().split(/\s+/)[0] : ""}'s number (optional)
            </Text>
            <TextInput
              ref={remindPhoneRef}
              value={remindPhone}
              onChangeText={setRemindPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
              placeholder="+1 555 000 0000"
              placeholderTextColor="#CBD5E1"
              style={{ height: 42, paddingHorizontal: 16, paddingVertical: 0, fontSize: 16, color: "#0F172A", textAlign: "left", backgroundColor: "#F8FAFC", borderRadius: 10, borderWidth: 1, borderColor: "#E2E8F0" }}
            />
          </View>
        )}

        <View style={{ backgroundColor: "#F8FAFC", borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "#E2E8F0" }}>
          <Text style={{ fontSize: 13, color: "#0F172A", lineHeight: 20 }}>
            {getRemindMessage(remindInvoice, includePayLink && !payLinkLoading ? payLinkUrl : null)}
          </Text>
        </View>

        {/* Include pay link row */}
        {(() => {
          const noMethods = includePayLink && !hasAnyPaymentMethod(localPm);
          if (noMethods) {
            const subtitle = payLinkLoading ? "Getting link…" : "Your link has no payment options yet";
            return (
              <View style={{ marginBottom: 16, backgroundColor: "#FFFBEB", borderWidth: 1, borderColor: "#FCD34D", borderRadius: 16, padding: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingVertical: 12 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: "#065F46" }}>Include pay link</Text>
                    <Text style={{ fontSize: 13, color: "#92400E", marginTop: 2 }}>{subtitle}</Text>
                  </View>
                  <View style={{ flexShrink: 0 }}>
                    <Switch
                      value={includePayLink}
                      onValueChange={saveIncludePayLink}
                      trackColor={{ false: "#CBD5E1", true: "#15803D" }}
                      ios_backgroundColor="#CBD5E1"
                      thumbColor="#FFFFFF"
                    />
                  </View>
                </View>
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", minHeight: 48, borderTopWidth: 1, borderTopColor: "#FDE68A", marginTop: 8, marginHorizontal: -12, paddingHorizontal: 12 }}
                  onPress={() => { track("paymethods_prompt_tapped", { from: "remind" }); setRemindSheetVisible(false); navigation.navigate("PaymentMethods"); }}
                >
                  <Text style={{ fontSize: 15, fontWeight: "600", color: "#92400E", flex: 1 }}>Add PayPal, Venmo or bank</Text>
                  <Ionicons name="chevron-forward" size={16} color="#92400E" />
                </TouchableOpacity>
              </View>
            );
          }
          const subtitle = payLinkLoading
            ? "Getting link…"
            : includePayLink && hasAnyPaymentMethod(localPm)
            ? `Clients see: ${getMethodNames(localPm)}`
            : "Message is sent without the link";
          return (
            <Pressable
              style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, marginBottom: 16, backgroundColor: includePayLink ? "#ECFDF5" : "#F8FAFC", borderWidth: 1, borderColor: includePayLink ? "transparent" : "#E2E8F0" }}
              onPress={() => saveIncludePayLink(!includePayLink)}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: includePayLink ? "#065F46" : "#0F172A" }}>Include pay link</Text>
                <Text style={{ fontSize: 13, color: includePayLink ? "#047857" : "#64748B", marginTop: 2 }}>{subtitle}</Text>
              </View>
              <View style={{ flexShrink: 0 }}>
                <Switch
                  value={includePayLink}
                  onValueChange={saveIncludePayLink}
                  trackColor={{ false: "#CBD5E1", true: "#15803D" }}
                  ios_backgroundColor="#CBD5E1"
                  thumbColor="#FFFFFF"
                />
              </View>
            </Pressable>
          );
        })()}

        <TouchableOpacity
          style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#ECFDF5", borderRadius: 14, padding: 16, marginBottom: 10 }}
          onPress={() => doSend("whatsapp")}
        >
          <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
          <Text style={{ fontSize: 15, fontWeight: "600", color: "#0F172A" }}>Send via WhatsApp</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#EFF6FF", borderRadius: 14, padding: 16, marginBottom: 4 }}
          onPress={() => doSend("sms")}
        >
          <Ionicons name="chatbubble-outline" size={22} color="#3B82F6" />
          <Text style={{ fontSize: 15, fontWeight: "600", color: "#0F172A" }}>Send via SMS</Text>
        </TouchableOpacity>
      </BottomSheet>

      {/* Claim confirm sheet */}
      <BottomSheet visible={claimSheetVisible} onClose={() => setClaimSheetVisible(false)}>
        {claimInvoice && (
          <>
            <Text style={{ fontSize: 20, fontWeight: "700", color: "#0F172A", marginBottom: 10 }}>
              Did {formatCurrency(claimInvoice.amount, currency, locale)} arrive?
            </Text>
            <Text style={{ fontSize: 15, color: "#475569", lineHeight: 22, marginBottom: 24 }}>
              {claimInvoice.client} marked {claimInvoice.description || "it"} as paid
              {methodLabel(claimInvoice.claimedMethod)},{" "}
              {relativeTime(claimInvoice.claimedAt)}.{" "}
              Check your account, then confirm.
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: "#059669", borderRadius: 14, padding: 16, alignItems: "center", marginBottom: 10 }}
              onPress={() => handleConfirmClaim(claimInvoice)}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Yes, mark as paid</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ backgroundColor: "#F8FAFC", borderRadius: 14, padding: 16, alignItems: "center", marginBottom: 8, borderWidth: 1, borderColor: "#E2E8F0" }}
              onPress={() => handleRejectClaim(claimInvoice)}
            >
              <Text style={{ color: "#334155", fontWeight: "600", fontSize: 15 }}>Not yet, keep it open</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 12, color: "#94A3B8", textAlign: "center", lineHeight: 18 }}>
              Confirming logs {formatCurrency(claimInvoice.amount, currency, locale)} as income and closes it in Owed to You.
            </Text>
          </>
        )}
      </BottomSheet>
    </View>
  );
}
