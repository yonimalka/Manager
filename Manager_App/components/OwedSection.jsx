import React, { useState, useRef, useEffect, useCallback } from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Reanimated, {
  useAnimatedStyle,
  interpolate,
  useAnimatedReaction,
  useSharedValue,
  runOnJS,
} from "react-native-reanimated";
import api from "../services/api";
import { formatCurrency } from "../services/formatCurrency";
import { track } from "../utils/analytics";
import BottomSheet from "./BottomSheet";

// ─── Phone helpers ──────────────────────────────────────────────────────────

const COUNTRY_CODES = { US: "1", CA: "1", GB: "44", IL: "972", AU: "61", IE: "353" };

const toIntl = (raw, region) => {
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

// ─── Swipe action panel ───────────────────────────────────────────────────────

function RightAction({ prog, onDelete, onFullSwipe, screenWidth }) {
  const fired = useSharedValue(false);

  // full swipe = dragged past 70% of screen width
  // prog is (drag_distance / action_width=88), so threshold = screenWidth*0.7/88
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
}) {
  const region = regionProp || locale.split("-")[1] || "US";
  const { width: screenWidth } = useWindowDimensions();

  // Remind sheet
  const [remindSheetVisible, setRemindSheetVisible] = useState(false);
  const [remindInvoice, setRemindInvoice] = useState(null);
  const [remindedIds, setRemindedIds] = useState({});
  const [remindPhone, setRemindPhone] = useState("");
  const remindPhoneRef = useRef(null);

  // Swipe-to-delete
  const [pendingDeleteIds, setPendingDeleteIds] = useState({});
  const [toastInvoice, setToastInvoice] = useState(null);
  const pendingRef = useRef({}); // { [id]: { invoice, method, timer } }
  const openSwipeableRef = useRef(null); // tracks the currently open swipeable

  useEffect(() => {
    return () => {
      // On unmount: clear all pending timers (do NOT commit — safe failure)
      Object.values(pendingRef.current).forEach(({ timer }) => clearTimeout(timer));
    };
  }, []);

  const commitDelete = useCallback(
    async (inv, method) => {
      try {
        await api.delete(`/invoices/${inv._id}`);
        track("owed_deleted", { method, undone: false });
        onChanged();
      } catch (e) {
        if (e.response?.status === 404) {
          onChanged();
        } else {
          // Restore the row
          setPendingDeleteIds((prev) => {
            const next = { ...prev };
            delete next[inv._id];
            return next;
          });
          Alert.alert("Couldn't delete", "Please try again.");
        }
      } finally {
        delete pendingRef.current[inv._id];
        setToastInvoice((cur) => (cur?._id === inv._id ? null : cur));
      }
    },
    [onChanged]
  );

  const startDelete = useCallback(
    (inv, method) => {
      // Close any open swipeable row
      if (openSwipeableRef.current) {
        openSwipeableRef.current.close();
        openSwipeableRef.current = null;
      }
      // Optimistically hide the row
      setPendingDeleteIds((prev) => ({ ...prev, [inv._id]: true }));
      setToastInvoice(inv);
      // Schedule server delete after 5 s
      const timer = setTimeout(() => commitDelete(inv, method), 5000);
      pendingRef.current[inv._id] = { invoice: inv, method, timer };
    },
    [commitDelete]
  );

  const handleUndo = useCallback(() => {
    if (!toastInvoice) return;
    const entry = pendingRef.current[toastInvoice._id];
    if (!entry) return;
    clearTimeout(entry.timer);
    delete pendingRef.current[toastInvoice._id];
    setPendingDeleteIds((prev) => {
      const next = { ...prev };
      delete next[toastInvoice._id];
      return next;
    });
    setToastInvoice(null);
    track("owed_delete_undone");
  }, [toastInvoice]);

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
    setRemindSheetVisible(true);
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

  const getRemindMessage = (invoice) => {
    if (!invoice) return "";
    const clientFirst = (invoice.client || "there").trim().split(/\s+/)[0];
    const userFirst = (userName || "").trim().split(/\s+/)[0] || "me";
    const amt = formatCurrency(invoice.amount || 0, currency, locale);
    const days = calcDayDiff(invoice.dueDate);
    if (days < 0) {
      const n = Math.abs(days);
      return `Hi ${clientFirst}, a quick reminder about the ${amt} payment for the job I did for you. It was due ${n} day${n !== 1 ? "s" : ""} ago. Could you take care of it this week? Thanks, ${userFirst}`;
    } else if (days === 0) {
      return `Hi ${clientFirst}, just a reminder that the ${amt} payment is due today. Thanks, ${userFirst}`;
    } else {
      return `Hi ${clientFirst}, a friendly heads-up that the ${amt} payment is due in ${days} day${days !== 1 ? "s" : ""}. Thanks, ${userFirst}`;
    }
  };

  const handleLongPress = useCallback(
    (inv) => {
      if (Platform.OS === "ios") {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: ["Cancel", "Remind", "Mark paid", "Delete"],
            destructiveButtonIndex: 3,
            cancelButtonIndex: 0,
          },
          (idx) => {
            if (idx === 1) handleOpenRemind(inv);
            else if (idx === 2) handleMarkPaid(inv);
            else if (idx === 3) startDelete(inv, "long_press");
          }
        );
      } else {
        Alert.alert(inv.client, undefined, [
          { text: "Remind", onPress: () => handleOpenRemind(inv) },
          { text: "Mark paid", onPress: () => handleMarkPaid(inv) },
          { text: "Delete", style: "destructive", onPress: () => startDelete(inv, "long_press") },
          { text: "Cancel", style: "cancel" },
        ]);
      }
    },
    [handleOpenRemind, handleMarkPaid, startDelete]
  );

  // Derived display values — exclude pending-deleted rows from totals
  const visibleItems = summary.items.filter((inv) => !pendingDeleteIds[inv._id]);
  const pendingAmount = summary.items
    .filter((inv) => pendingDeleteIds[inv._id])
    .reduce((sum, inv) => sum + inv.amount, 0);
  const pendingLate = summary.items.filter(
    (inv) => pendingDeleteIds[inv._id] && calcDayDiff(inv.dueDate) < 0
  ).length;
  const displayTotal = summary.totalOwed - pendingAmount;
  const displayOverdue = summary.overdueCount - pendingLate;

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
        /* Card */
        <View style={{ backgroundColor: "#fff", borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
          {/* Summary row */}
          <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
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
            const circleBg = isLate ? "#FEF2F2" : isToday || isSoon ? "#FFFBEB" : "#F1F5F9";
            const circleText = isLate ? "#DC2626" : isToday || isSoon ? "#B45309" : "#475569";

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
              statusLabel = `Due in ${days} days`; statusColor = "#64748B"; statusWeight = "400";
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
            const barColor = isLate ? "#EF4444" : isToday || isSoon ? "#F59E0B" : "#94A3B8";

            let remBg, remBorderW, remBorderC, remTxt, remLabel;
            if (reminded) {
              remBg = "#F8FAFC"; remBorderW = 0; remBorderC = "transparent"; remTxt = "#94A3B8"; remLabel = "Sent";
            } else if (isLate) {
              remBg = "#FEF2F2"; remBorderW = 0; remBorderC = "transparent"; remTxt = "#DC2626"; remLabel = "Remind";
            } else {
              remBg = "#fff"; remBorderW = 1; remBorderC = "#E2E8F0"; remTxt = "#334155"; remLabel = "Remind";
            }

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
                  // Close any other open row before this one opens
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
                  activeOpacity={1}
                  delayLongPress={350}
                  onLongPress={() => handleLongPress(inv)}
                  style={{ flexDirection: "row", backgroundColor: "#fff" }}
                >
                  {isLate && <View style={{ width: 3, backgroundColor: "#EF4444" }} />}
                  <View style={{ flex: 1, paddingTop: 14, paddingBottom: 14, paddingLeft: isLate ? 13 : 16, paddingRight: 16 }}>
                    {/* Row 1: initials + name + amount */}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: circleBg, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Text style={{ fontSize: 13, fontWeight: "700", color: circleText }}>{initials}</Text>
                      </View>
                      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <Text style={{ fontSize: 16, fontWeight: "600", color: "#0F172A", flex: 1, marginRight: 8 }} numberOfLines={1}>{inv.client}</Text>
                        <Text style={{ fontSize: 16, fontWeight: "700", color: "#0F172A" }}>
                          {formatCurrency(inv.amount, currency, locale)}
                        </Text>
                      </View>
                    </View>
                    {/* Row 2: status + bar + buttons */}
                    <View style={{ flexDirection: "row", alignItems: "flex-end", marginLeft: 48, gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: statusWeight, color: statusColor, marginBottom: 5 }}>
                          {statusLabel}
                          {showRemindedAgo && (
                            <Text style={{ fontWeight: "400" }}>{` · reminded ${remDaysAgo}d ago`}</Text>
                          )}
                        </Text>
                        <View style={{ width: 96, height: 4, backgroundColor: "#F1F5F9", borderRadius: 2, overflow: "hidden" }}>
                          <View style={{ width: Math.round(barPct * 96), height: 4, backgroundColor: barColor, borderRadius: 2 }} />
                        </View>
                      </View>
                      <View style={{ flexDirection: "row", gap: 6 }}>
                        <TouchableOpacity
                          onPress={() => handleOpenRemind(inv)}
                          style={{ minHeight: 34, paddingHorizontal: 10, borderRadius: 10, backgroundColor: remBg, borderWidth: remBorderW, borderColor: remBorderC, flexDirection: "row", alignItems: "center", gap: 5 }}
                        >
                          <Ionicons name="chatbubble-outline" size={13} color={remTxt} />
                          <Text style={{ fontSize: 13, fontWeight: "600", color: remTxt }}>{remLabel}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleMarkPaid(inv)}
                          style={{ minHeight: 34, paddingHorizontal: 10, borderRadius: 10, backgroundColor: "#ECFDF5", flexDirection: "row", alignItems: "center", gap: 5 }}
                        >
                          <Ionicons name="checkmark" size={13} color="#059669" />
                          <Text style={{ fontSize: 13, fontWeight: "700", color: "#059669" }}>Paid</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              </ReanimatedSwipeable>
            );
          })}
        </View>
      ) : null}

      {/* Undo toast */}
      {toastInvoice && (
        <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#0F172A", borderRadius: 28, paddingVertical: 12, paddingLeft: 18, paddingRight: 8, gap: 12, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8 }}>
            <Text style={{ fontSize: 14, color: "#fff", fontWeight: "500" }} numberOfLines={1}>
              {toastInvoice.client} deleted
            </Text>
            <TouchableOpacity onPress={handleUndo} style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#34d399" }}>Undo</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

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
              style={{ fontSize: 14, color: "#0F172A", backgroundColor: "#F8FAFC", borderRadius: 10, borderWidth: 1, borderColor: "#E2E8F0", paddingHorizontal: 12, paddingVertical: 10 }}
            />
          </View>
        )}

        <View style={{ backgroundColor: "#F8FAFC", borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: "#E2E8F0" }}>
          <Text style={{ fontSize: 13, color: "#0F172A", lineHeight: 20 }}>
            {getRemindMessage(remindInvoice)}
          </Text>
        </View>

        <TouchableOpacity
          style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#ECFDF5", borderRadius: 14, padding: 16, marginBottom: 10 }}
          onPress={async () => {
            const rawPhone = remindInvoice?.clientPhone || remindPhone.trim();
            const intlPhone = toIntl(rawPhone, region);
            const msg = encodeURIComponent(getRemindMessage(remindInvoice));
            const url = intlPhone ? `https://wa.me/${intlPhone}?text=${msg}` : `https://wa.me/?text=${msg}`;
            try {
              await Linking.openURL(url);
              if (!remindInvoice?.clientPhone && remindPhone.trim()) savePhone(remindInvoice._id, remindPhone.trim());
              await markReminded(remindInvoice, "whatsapp");
              setRemindSheetVisible(false);
            } catch (e) {
              Alert.alert("Couldn't open WhatsApp", "Make sure it's installed, or try the other option.");
            }
          }}
        >
          <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
          <Text style={{ fontSize: 15, fontWeight: "600", color: "#0F172A" }}>Send via WhatsApp</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#EFF6FF", borderRadius: 14, padding: 16, marginBottom: 4 }}
          onPress={async () => {
            const rawPhone = remindInvoice?.clientPhone || remindPhone.trim();
            const intlPhone = rawPhone ? "+" + toIntl(rawPhone, region) : "";
            const msg = encodeURIComponent(getRemindMessage(remindInvoice));
            const url = Platform.OS === "ios" ? `sms:${intlPhone}&body=${msg}` : `sms:${intlPhone}?body=${msg}`;
            try {
              await Linking.openURL(url);
              if (!remindInvoice?.clientPhone && remindPhone.trim()) savePhone(remindInvoice._id, remindPhone.trim());
              await markReminded(remindInvoice, "sms");
              setRemindSheetVisible(false);
            } catch (e) {
              Alert.alert("Couldn't open Messages", "Make sure it's installed, or try the other option.");
            }
          }}
        >
          <Ionicons name="chatbubble-outline" size={22} color="#3B82F6" />
          <Text style={{ fontSize: 15, fontWeight: "600", color: "#0F172A" }}>Send via SMS</Text>
        </TouchableOpacity>
      </BottomSheet>
    </View>
  );
}
