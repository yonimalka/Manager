import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { SERVER_URL } from "@env";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../services/api";
import { useAuth } from "./useAuth";
import { formatCurrency } from "../services/formatCurrency";
import { track } from "../utils/analytics";
import IncomeReceiptGenerator from "./IncomesReceiptGenerator";
import Receipts from "./Receipts";
import BottomSheet from "./BottomSheet";

// ── Design tokens ──────────────────────────────────────────────────────────
const C = {
  bg:       "#F7F7F5",
  card:     "#FFFFFF",
  border:   "#E6E6E1",
  ink:      "#17181C",
  muted:    "#5E616A",
  divider:  "#EFEFEB",
  link:     "#2457D6",
  green:    "#0E7246",
  spentDot: "#C2410C",
  track:    "#EDEDE9",
};

export default function AboutProject() {
  const navigation      = useNavigation();
  const route           = useRoute();
  const { top: topInset } = useSafeAreaInsets();
  const project         = route.params?.project;
  const projectId       = project?._id;
  const { userDetails } = useAuth();

  // ── Server state ──────────────────────────────────────────────────────
  const [projectDetails, setProjectDetails] = useState(null);
  const [expenses,       setExpenses]       = useState(0);
  const [toDoList,       setToDoList]       = useState(project?.toDoList || []);
  const [materialsArray, setMaterialsArray] = useState(project?.materials?.items || []);

  // ── Modal / sheet state ───────────────────────────────────────────────
  const [incomeModalVisible,   setIncomeModalVisible]   = useState(false);
  const [receiptModalVisible,  setReceiptModalVisible]  = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleting,             setDeleting]             = useState(false);
  const [menuSheetVisible,     setMenuSheetVisible]     = useState(false);
  const [editSheetVisible,     setEditSheetVisible]     = useState(false);
  const [jobValueSheetVisible, setJobValueSheetVisible] = useState(false);
  const [billSheetVisible,     setBillSheetVisible]     = useState(false);
  const [demoBannerVisible,    setDemoBannerVisible]    = useState(false);

  // ── Tabs ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("tasks");

  // ── Inline add ───────────────────────────────────────────────────────
  const [isAddingTask,     setIsAddingTask]     = useState(false);
  const [isAddingMaterial, setIsAddingMaterial] = useState(false);
  const [taskValue,        setTaskValue]        = useState("");
  const [detailsValue,     setDetailsValue]     = useState("");
  const [itemValue,        setItemValue]        = useState("");
  const [qtyValue,         setQtyValue]         = useState("");
  const taskInputRef     = useRef(null);
  const matNameRef       = useRef(null);

  // ── Edit sheet ───────────────────────────────────────────────────────
  const [editName,        setEditName]        = useState("");
  const [editClient,      setEditClient]      = useState("");
  const [editClientPhone, setEditClientPhone] = useState("");
  const [editDays,        setEditDays]        = useState("");
  const [editSaving,      setEditSaving]      = useState(false);

  // ── Job value sheet ──────────────────────────────────────────────────
  const [jobValueInput,  setJobValueInput]  = useState("");
  const [jobValueSaving, setJobValueSaving] = useState(false);

  // ── Bill client sheet ─────────────────────────────────────────────────
  const [billAmountMode,   setBillAmountMode]   = useState("all");
  const [billCustomAmount, setBillCustomAmount] = useState("");
  const [billDueDays,      setBillDueDays]      = useState(14);
  const [billClientName,   setBillClientName]   = useState("");
  const [billSaving,       setBillSaving]       = useState(false);

  // ── ZIP ──────────────────────────────────────────────────────────────
  const [zipDownloading, setZipDownloading] = useState(false);

  // ── Computed values ───────────────────────────────────────────────────
  const cur = userDetails?.currency || "USD";
  const loc = userDetails?.locale   || "en-US";
  const fmt = (n) => formatCurrency(n, cur, loc);

  const paid      = projectDetails?.paid    || 0;
  const spent     = expenses;
  const profit    = paid - spent;
  const margin    = paid > 0 ? Math.round((profit / paid) * 100) : null;
  const jobValue  = projectDetails?.payment || 0;
  const owed      = Math.max(jobValue - paid, 0);
  const collected = jobValue > 0 ? Math.min(100, Math.round((paid / jobValue) * 100)) : 0;
  const billed    = projectDetails?.billed  || 0;
  const unbilled  = Math.max(owed - billed, 0);
  const createdAt = projectDetails?.createdAt || project?.createdAt;
  const days      = projectDetails?.days      || project?.days || 0;
  const dayNum    = createdAt
    ? Math.floor((Date.now() - new Date(createdAt)) / 86400000) + 1
    : 1;
  const isComplete = projectDetails?.status === "complete";
  const client     = projectDetails?.client   || "";
  const nextDue    = projectDetails?.nextDue;
  const money      = projectDetails?.money    || [];

  const nextDueDays = nextDue
    ? Math.round((new Date(nextDue) - new Date()) / 86400000)
    : null;

  const billAmount = billAmountMode === "all"
    ? unbilled
    : billAmountMode === "half"
      ? Math.round(unbilled / 2)
      : Number(billCustomAmount) || 0;

  const empty = paid === 0 && spent === 0;

  // ── Fetch ─────────────────────────────────────────────────────────────
  const fetchProject = useCallback(async () => {
    try {
      const res = await api.get(`/getProject/${projectId}`);
      setProjectDetails(res.data);
      setExpenses(res.data.expenses || 0);
      setToDoList(res.data.toDoList || []);
      setMaterialsArray(res.data.materials?.items || []);
    } catch (err) {
      console.error("fetchProject error:", err);
    }
  }, [projectId]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  useEffect(() => {
    if (!project?.isDemo) return;
    AsyncStorage.getItem("maggo_demo_banner_dismissed").then((v) => {
      if (!v) setDemoBannerVisible(true);
    });
  }, [project?.isDemo]);

  useEffect(() => {
    if (project?._id) {
      try {
        track("project_viewed", { projectId: project._id, paid: project.paid || 0, total: project.total || 0 });
      } catch (e) {}
    }
  }, [project?._id]);

  const dismissDemoBanner = async () => {
    await AsyncStorage.setItem("maggo_demo_banner_dismissed", "true");
    setDemoBannerVisible(false);
  };

  // ── Existing handlers ─────────────────────────────────────────────────
  const toggleCheck = async (item, index) => {
    const updated = toDoList.map((task, i) =>
      i === index ? { ...task, checked: !task.checked } : task
    );
    updated.sort((a, b) => a.checked - b.checked);
    setToDoList(updated);
    try {
      await api.post(`/updateTasks/${projectId}`, { ...item, checked: !item.checked });
    } catch (err) { console.error(err); }
  };

  const handleAddTask = async () => {
    if (!taskValue.trim()) return;
    const newItem = { task: taskValue.trim(), details: detailsValue };
    setToDoList([...toDoList, { ...newItem, checked: false }]);
    setTaskValue("");
    setDetailsValue("");
    try { await api.post(`/AddTask/${projectId}`, newItem); }
    catch (err) { console.error(err); }
  };

  const handleAddMaterial = async () => {
    if (!itemValue || !qtyValue) return;
    const newItem = { item: itemValue, qty: Number(qtyValue) };
    try {
      const res = await api.post(`/AddItem/${projectId}`, newItem);
      setMaterialsArray(res.data.materials);
      setItemValue("");
      setQtyValue("");
      setIsAddingMaterial(false);
    } catch (err) { console.error(err); }
  };

  const submitIncomeReceipt = async () => { fetchProject(); };

  const handleProjectDelete = async () => {
    setDeleting(true);
    try {
      try { track("project_deleted", { projectId: project._id }); } catch (e) {}
      await api.delete(`/deleteProject/${projectId}`);
      setDeleteConfirmVisible(false);
      navigation.goBack();
    } catch (err) {
      console.error(err);
      setDeleting(false);
    }
  };

  const removeMaterial = async (materialId) => {
    setMaterialsArray((prev) => prev.filter((m) => m._id !== materialId));
    try {
      await api.delete(`/projects/${projectId}/materials/${materialId}`);
    } catch (err) {
      console.error("Delete material error:", err);
      fetchProject();
    }
  };

  // ── PATCH helper ──────────────────────────────────────────────────────
  const patchProject = async (body) => {
    const res = await api.patch(`/projects/${projectId}`, body);
    return res.data;
  };

  // ── Sheet handlers ────────────────────────────────────────────────────
  const openEditSheet = () => {
    setEditName(projectDetails?.name || project?.name || "");
    setEditClient(projectDetails?.client || "");
    setEditClientPhone(projectDetails?.clientPhone || "");
    setEditDays(String(projectDetails?.days || project?.days || ""));
    setMenuSheetVisible(false);
    setEditSheetVisible(true);
  };

  const openJobValueSheet = () => {
    setJobValueInput(jobValue > 0 ? String(jobValue) : "");
    setMenuSheetVisible(false);
    setJobValueSheetVisible(true);
  };

  const openBillSheet = () => {
    setBillAmountMode("all");
    setBillCustomAmount("");
    setBillDueDays(14);
    setBillClientName("");
    setBillSheetVisible(true);
  };

  const handleEditSave = async () => {
    if (!editName.trim()) return;
    setEditSaving(true);
    try {
      await patchProject({
        name:        editName.trim(),
        client:      editClient,
        clientPhone: editClientPhone,
        ...(editDays ? { days: Number(editDays) } : {}),
      });
      await fetchProject();
      setEditSheetVisible(false);
    } catch (err) {
      Alert.alert("Error", "Could not save changes.");
    } finally {
      setEditSaving(false);
    }
  };

  const handleJobValueSave = async () => {
    const v = Number(jobValueInput);
    if (!v || v < 0) return;
    setJobValueSaving(true);
    try {
      await patchProject({ payment: v });
      await fetchProject();
      setJobValueSheetVisible(false);
    } catch (err) {
      Alert.alert("Error", "Could not save job value.");
    } finally {
      setJobValueSaving(false);
    }
  };

  const handleStatusToggle = async () => {
    try {
      await patchProject({ status: isComplete ? "active" : "complete" });
      await fetchProject();
      setMenuSheetVisible(false);
    } catch (err) {
      Alert.alert("Error", "Could not update status.");
    }
  };

  const handleBillSave = async () => {
    if (billAmount <= 0) return;
    const finalClient = client || billClientName.trim();
    if (!finalClient) return;
    setBillSaving(true);
    try {
      if (!client && billClientName.trim()) {
        await patchProject({ client: billClientName.trim() });
      }
      await api.post("/invoices", {
        client:      finalClient,
        clientPhone: projectDetails?.clientPhone || undefined,
        amount:      billAmount,
        projectId,
        dueDays:     billDueDays,
      });
      track("project_billed", { amount: billAmount, dueDays: billDueDays });
      await fetchProject();
      setBillSheetVisible(false);
    } catch (err) {
      Alert.alert("Error", "Could not create invoice.");
    } finally {
      setBillSaving(false);
    }
  };

  const handleDownloadZip = async () => {
    try {
      setZipDownloading(true);
      const token   = await AsyncStorage.getItem("token");
      const fileUri = FileSystem.documentDirectory + "Receipts.zip";
      const res     = await FileSystem.downloadAsync(
        `${SERVER_URL}/downloadReceiptsZip?projectId=${projectId}`,
        fileUri,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.status !== 200) {
        Alert.alert("No receipts", "No expense receipts found for this project.");
        return;
      }
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: "application/zip" });
      }
    } catch (err) {
      Alert.alert("Error", "Could not download receipts.");
    } finally {
      setZipDownloading(false);
    }
  };

  const formatDate = (d) =>
    new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short" });

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <View style={s.screen}>

      {/* Header row */}
      <View style={[s.headerRow, { paddingTop: topInset + 6 }]}>
        <TouchableOpacity style={s.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={C.ink} />
        </TouchableOpacity>
        <TouchableOpacity style={s.iconBtn} onPress={() => setMenuSheetVisible(true)}>
          <Ionicons name="ellipsis-horizontal" size={20} color={C.ink} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Title + meta */}
        <View style={s.titleBlock}>
          <Text style={s.title} numberOfLines={3}>
            {projectDetails?.name || project?.name}
          </Text>
          <View style={s.metaRow}>
            <View style={[s.statusPill, isComplete ? s.statusComplete : s.statusActive]}>
              <View style={[s.statusDot, { backgroundColor: isComplete ? C.green : C.link }]} />
              <Text style={[s.statusText, { color: isComplete ? C.green : "#1E46B4" }]}>
                {isComplete ? "Complete" : "In progress"}
              </Text>
            </View>
            <Text style={s.metaMuted}>
              {dayNum > days ? `${dayNum - days}d over` : `Day ${dayNum} of ${days}`}
            </Text>
            {client ? (
              <Text style={s.metaMuted}>{" · "}{client}</Text>
            ) : (
              <TouchableOpacity onPress={openEditSheet}>
                <Text style={[s.metaMuted, { color: C.link }]}>{" · + Add client"}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Demo banner */}
        {demoBannerVisible && (
          <View style={s.demoBanner}>
            <Ionicons name="information-circle-outline" size={18} color="#92400E" style={{ marginTop: 1 }} />
            <Text style={s.demoBannerText}>This is a demo — edit it or create your own.</Text>
            <TouchableOpacity onPress={dismissDemoBanner} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={18} color="#92400E" />
            </TouchableOpacity>
          </View>
        )}

        {/* Money card */}
        <View style={s.card}>
          {empty ? (
            <>
              <Text style={s.profitLabel}>Profit so far</Text>
              <Text style={[s.profitAmount, { color: "#B8B8B1", marginBottom: 10 }]}>{fmt(0)}</Text>
              <Text style={s.emptyMoneyBody}>
                Log the deposit when it lands and every expense as you go. Profit and what's still owed update on their own.
              </Text>
              {jobValue === 0 && (
                <TouchableOpacity style={s.dashedBtn} onPress={openJobValueSheet}>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: C.link }}>+ Set job value</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <>
              {/* a. Profit */}
              <Text style={s.profitLabel}>Profit so far</Text>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 14 }}>
                <Text style={s.profitAmount}>{fmt(profit)}</Text>
                {margin !== null && (
                  <Text style={{ fontSize: 13, fontWeight: "600", color: C.green }}>{margin}% margin</Text>
                )}
              </View>

              {/* b. Two tiles */}
              <View style={s.tilesRow}>
                <View style={s.tile}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <View style={[s.dot, { backgroundColor: C.green }]} />
                    <Text style={s.tileLabel}>Paid to you</Text>
                  </View>
                  <Text style={s.tileValue}>{fmt(paid)}</Text>
                </View>
                <View style={s.tile}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <View style={[s.dot, { backgroundColor: C.spentDot }]} />
                    <Text style={s.tileLabel}>Spent</Text>
                  </View>
                  <Text style={s.tileValue}>{fmt(spent)}</Text>
                </View>
              </View>

              {/* c. Job value row */}
              {jobValue > 0 && (
                <View style={[s.jobRow, { borderTopColor: C.divider }]}>
                  <Text style={s.metaMuted}>Job value {fmt(jobValue)}</Text>
                  {owed === 0 ? (
                    <Text style={{ fontSize: 14, fontWeight: "600", color: C.green }}>Fully paid</Text>
                  ) : (
                    <Text style={{ fontSize: 14, fontWeight: "600", color: C.ink }}>{fmt(owed)} still owed</Text>
                  )}
                </View>
              )}

              {/* d. Bar */}
              {jobValue > 0 && (
                <View style={s.barTrack}>
                  <View style={[s.barFill, { width: `${collected}%` }]} />
                </View>
              )}

              {/* e. Collected row */}
              {jobValue > 0 && (
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                  <Text style={{ fontSize: 12, color: C.muted }}>{collected}% collected</Text>
                  {unbilled > 0 && (
                    <TouchableOpacity style={s.billChip} onPress={openBillSheet}>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: C.ink }}>Bill client ›</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* f. Billed strip */}
              {billed > 0 && (
                <View style={s.billedStrip}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={[s.dot, { backgroundColor: "#F59E0B" }]} />
                    <Text style={{ fontSize: 13, color: "#9A3412" }}>
                      {fmt(billed)} billed
                      {nextDueDays !== null
                        ? nextDueDays < 0
                          ? ` · overdue ${Math.abs(nextDueDays)} days`
                          : ` · due in ${nextDueDays} days`
                        : ""}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#9A3412" }}>In Owed to You</Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Action buttons */}
        <View style={s.actionRow}>
          <TouchableOpacity
            style={[s.actionBtn, s.actionBtnGreen]}
            onPress={() => setIncomeModalVisible(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="cash" size={20} color="#fff" />
            <Text style={s.actionBtnTextWhite}>Log Payment</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.actionBtn, s.actionBtnWhite]}
            onPress={() => setReceiptModalVisible(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="card" size={20} color="#EF4444" />
            <Text style={s.actionBtnTextInk}>Add Expense</Text>
          </TouchableOpacity>
        </View>

        {/* Segmented tabs */}
        <View style={s.tabTrack}>
          {[
            { key: "tasks",     label: `Tasks ${toDoList.length}` },
            { key: "materials", label: `Materials ${materialsArray.length}` },
            { key: "money",     label: `Money ${money.length}` },
          ].map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[s.tabBtn, activeTab === t.key && s.tabBtnActive]}
              onPress={() => setActiveTab(t.key)}
            >
              <Text style={[s.tabBtnText, activeTab === t.key && s.tabBtnTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab card */}
        <View style={s.tabCard}>

          {/* ── Tasks ── */}
          {activeTab === "tasks" && (
            <>
              {toDoList.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={s.taskRow}
                  onPress={() => toggleCheck(item, index)}
                  activeOpacity={0.7}
                >
                  <View style={[s.checkCircle, item.checked && s.checkCircleDone]}>
                    {item.checked && <Ionicons name="checkmark" size={13} color="#fff" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.taskName, item.checked && s.taskNameDone]}>{item.task}</Text>
                    {!!item.details && <Text style={s.taskDetails}>{item.details}</Text>}
                  </View>
                </TouchableOpacity>
              ))}
              {isAddingTask && (
                <View style={s.inlineAddRow}>
                  <TextInput
                    ref={taskInputRef}
                    style={s.inlineInput}
                    placeholder="Task name"
                    placeholderTextColor={C.muted}
                    value={taskValue}
                    onChangeText={setTaskValue}
                    returnKeyType="done"
                    onSubmitEditing={() => {
                      handleAddTask();
                      setTimeout(() => taskInputRef.current?.focus(), 50);
                    }}
                    autoFocus
                  />
                </View>
              )}
              <TouchableOpacity
                style={s.addRowBtn}
                onPress={() => {
                  setIsAddingTask(true);
                  setTimeout(() => taskInputRef.current?.focus(), 80);
                }}
              >
                <Text style={s.addRowBtnText}>+ Add a task</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── Materials ── */}
          {activeTab === "materials" && (
            <>
              {materialsArray.map((item) => (
                <Swipeable
                  key={item._id}
                  renderRightActions={() => (
                    <TouchableOpacity
                      style={s.deleteAction}
                      onPress={() => removeMaterial(item._id)}
                    >
                      <Ionicons name="trash" size={20} color="#fff" />
                    </TouchableOpacity>
                  )}
                >
                  <View style={s.materialRow}>
                    <Text style={s.materialName}>{item.item}</Text>
                    <Text style={s.materialQty}>{item.qty} pcs</Text>
                  </View>
                </Swipeable>
              ))}
              {isAddingMaterial && (
                <View style={s.inlineAddRow}>
                  <TextInput
                    ref={matNameRef}
                    style={[s.inlineInput, { flex: 1 }]}
                    placeholder="Item name"
                    placeholderTextColor={C.muted}
                    value={itemValue}
                    onChangeText={setItemValue}
                    returnKeyType="next"
                    autoFocus
                  />
                  <TextInput
                    style={[s.inlineInput, { width: 72 }]}
                    placeholder="Qty"
                    placeholderTextColor={C.muted}
                    value={qtyValue}
                    onChangeText={setQtyValue}
                    keyboardType="numeric"
                    returnKeyType="done"
                    onSubmitEditing={handleAddMaterial}
                  />
                </View>
              )}
              <TouchableOpacity
                style={s.addRowBtn}
                onPress={() => setIsAddingMaterial(true)}
              >
                <Text style={s.addRowBtnText}>+ Add material</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── Money ── */}
          {activeTab === "money" && (
            <>
              {money.length === 0 ? (
                <Text style={s.emptyTabText}>
                  Payments and expenses for this job show up here.
                </Text>
              ) : (
                money.map((item) => {
                  const isPayment = item.type === "payment";
                  return (
                    <TouchableOpacity
                      key={String(item.id)}
                      style={s.moneyRow}
                      activeOpacity={!isPayment && item.imageUrl ? 0.7 : 1}
                      onPress={() => {
                        if (!isPayment && item.imageUrl) {
                          navigation.navigate("ReceiptPreview", { item: { imageUrl: item.imageUrl } });
                        }
                      }}
                    >
                      <View style={[s.moneyBadge, isPayment ? s.moneyBadgeGreen : s.moneyBadgeRed]}>
                        <Text style={[s.moneyBadgeText, { color: isPayment ? C.green : "#9A3412" }]}>
                          {isPayment ? "+" : "−"}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.moneyTitle}>{item.title}</Text>
                        <Text style={s.moneyMeta}>
                          {isPayment ? "Payment" : "Expense"} · {formatDate(item.date)}
                          {!isPayment && item.imageUrl ? " · photo" : ""}
                        </Text>
                      </View>
                      <Text style={[s.moneyAmount, { color: isPayment ? C.green : C.ink }]}>
                        {isPayment ? "+" : "−"}{fmt(item.amount)}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
              <TouchableOpacity
                style={s.downloadZipRow}
                onPress={handleDownloadZip}
                disabled={zipDownloading}
              >
                <Ionicons name="download-outline" size={16} color={C.link} />
                <Text style={[s.addRowBtnText, { color: C.link }]}>
                  {zipDownloading ? "Downloading…" : "Download receipts (ZIP)"}
                </Text>
              </TouchableOpacity>
            </>
          )}

        </View>
      </ScrollView>

      {/* ── Income modal ─────────────────────────────────────────────────── */}
      <Modal visible={incomeModalVisible} animationType="fade" transparent onRequestClose={() => setIncomeModalVisible(false)}>
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <IncomeReceiptGenerator
              projectId={projectId}
              onSubmit={() => { submitIncomeReceipt(); setIncomeModalVisible(false); }}
              onClose={() => setIncomeModalVisible(false)}
            />
          </View>
        </View>
      </Modal>

      {/* ── Expense modal ─────────────────────────────────────────────────── */}
      <Modal visible={receiptModalVisible} transparent animationType="fade" statusBarTranslucent>
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <Receipts onClose={() => setReceiptModalVisible(false)} projectId={projectId} />
          </View>
        </View>
      </Modal>

      {/* ── Delete confirm modal ──────────────────────────────────────────── */}
      <Modal visible={deleteConfirmVisible} transparent animationType="fade" statusBarTranslucent>
        <View style={s.modalBackdrop}>
          <View style={s.deleteModal}>
            <View style={s.deleteModalIcon}>
              <Ionicons name="trash-outline" size={32} color="#EF4444" />
            </View>
            <Text style={s.deleteModalTitle}>Delete Project?</Text>
            <Text style={s.deleteModalBody}>
              This will permanently remove "{projectDetails?.name || project?.name}" and all its data. This action cannot be undone.
            </Text>
            <TouchableOpacity
              style={[s.deleteModalConfirm, deleting && { opacity: 0.6 }]}
              onPress={handleProjectDelete}
              disabled={deleting}
            >
              <Text style={s.deleteModalConfirmText}>{deleting ? "Deleting…" : "Yes, Delete"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.deleteModalCancel}
              onPress={() => setDeleteConfirmVisible(false)}
              disabled={deleting}
            >
              <Text style={s.deleteModalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── ••• Menu sheet ────────────────────────────────────────────────── */}
      <BottomSheet visible={menuSheetVisible} onClose={() => setMenuSheetVisible(false)}>
        <Text style={s.sheetMeta}>{projectDetails?.name || project?.name}</Text>
        {[
          { label: "Edit name, client and days",                   icon: "pencil-outline",           onPress: openEditSheet },
          { label: "Set job value",                                 icon: "pricetag-outline",          onPress: openJobValueSheet },
          { label: isComplete ? "Reopen job" : "Mark job as complete", icon: isComplete ? "refresh-outline" : "checkmark-circle-outline", onPress: handleStatusToggle },
          { label: "Delete project", icon: "trash-outline", color: "#B42318", onPress: () => { setMenuSheetVisible(false); setDeleteConfirmVisible(true); } },
        ].map((row, i, arr) => (
          <React.Fragment key={row.label}>
            <TouchableOpacity style={s.menuRow} onPress={row.onPress} activeOpacity={0.7}>
              <Ionicons name={row.icon} size={20} color={row.color || C.ink} />
              <Text style={[s.menuRowText, row.color && { color: row.color }]}>{row.label}</Text>
            </TouchableOpacity>
            {i < arr.length - 1 && <View style={s.menuDivider} />}
          </React.Fragment>
        ))}
      </BottomSheet>

      {/* ── Edit sheet ────────────────────────────────────────────────────── */}
      <BottomSheet visible={editSheetVisible} onClose={() => setEditSheetVisible(false)}>
        <Text style={s.sheetTitle}>Edit project</Text>
        {[
          { label: "Name",                   value: editName,        set: setEditName,        kb: "default" },
          { label: "Client",                  value: editClient,      set: setEditClient,      kb: "default" },
          { label: "Client phone (optional)", value: editClientPhone, set: setEditClientPhone, kb: "phone-pad" },
          { label: "Days",                    value: editDays,        set: setEditDays,        kb: "numeric" },
        ].map((f) => (
          <View key={f.label} style={s.sheetField}>
            <Text style={s.sheetLabel}>{f.label}</Text>
            <TextInput
              style={s.sheetInput}
              value={f.value}
              onChangeText={f.set}
              keyboardType={f.kb}
              placeholder={f.label}
              placeholderTextColor={C.muted}
            />
          </View>
        ))}
        <TouchableOpacity
          style={[s.sheetSaveBtn, editSaving && { opacity: 0.6 }]}
          onPress={handleEditSave}
          disabled={editSaving}
        >
          <Text style={s.sheetSaveBtnText}>{editSaving ? "Saving…" : "Save"}</Text>
        </TouchableOpacity>
      </BottomSheet>

      {/* ── Job value sheet ───────────────────────────────────────────────── */}
      <BottomSheet visible={jobValueSheetVisible} onClose={() => setJobValueSheetVisible(false)}>
        <Text style={s.sheetTitle}>Job value</Text>
        <Text style={s.sheetBody}>
          The total you agreed with the client. Maggo uses it to show what's still owed.
        </Text>
        <View style={s.jobValueInputRow}>
          <Text style={s.jobValuePrefix}>{userDetails?.currencySymbol || "$"}</Text>
          <TextInput
            style={s.jobValueInput}
            value={jobValueInput}
            onChangeText={setJobValueInput}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={C.muted}
            autoFocus
          />
        </View>
        {!!jobValueInput && (
          <View style={s.jobValueLive}>
            <Text style={s.jobValueLiveText}>
              Paid so far{"  "}
              <Text style={{ fontWeight: "600", color: C.ink }}>{fmt(paid)}</Text>
            </Text>
            <Text style={s.jobValueLiveText}>
              Still owed{"  "}
              <Text style={{ fontWeight: "600", color: C.ink }}>
                {fmt(Math.max((Number(jobValueInput) || 0) - paid, 0))}
              </Text>
            </Text>
          </View>
        )}
        <TouchableOpacity
          style={[s.sheetSaveBtn, jobValueSaving && { opacity: 0.6 }]}
          onPress={handleJobValueSave}
          disabled={jobValueSaving}
        >
          <Text style={s.sheetSaveBtnText}>{jobValueSaving ? "Saving…" : "Save"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.notSureBtn} onPress={() => setJobValueSheetVisible(false)}>
          <Text style={s.notSureBtnText}>Not sure yet</Text>
        </TouchableOpacity>
      </BottomSheet>

      {/* ── Bill client sheet ─────────────────────────────────────────────── */}
      <BottomSheet visible={billSheetVisible} onClose={() => setBillSheetVisible(false)}>
        <Text style={s.sheetTitle}>Bill {client || "client"}</Text>
        <Text style={s.sheetBody}>
          {fmt(owed)} is still owed on this job. How much are you asking for now?
        </Text>
        {!client && (
          <View style={s.sheetField}>
            <Text style={s.sheetLabel}>Client name</Text>
            <TextInput
              style={s.sheetInput}
              value={billClientName}
              onChangeText={setBillClientName}
              placeholder="Required"
              placeholderTextColor={C.muted}
              autoCapitalize="words"
            />
          </View>
        )}
        <View style={s.chipRow}>
          {[
            { key: "all",   label: `All  ${fmt(unbilled)}` },
            { key: "half",  label: `Half  ${fmt(Math.round(unbilled / 2))}` },
            { key: "other", label: "Other" },
          ].map((c) => (
            <TouchableOpacity
              key={c.key}
              style={[s.chip, billAmountMode === c.key && s.chipActive]}
              onPress={() => setBillAmountMode(c.key)}
            >
              <Text style={[s.chipText, billAmountMode === c.key && s.chipTextActive]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {billAmountMode === "other" && (
          <TextInput
            style={[s.sheetInput, { marginBottom: 8 }]}
            value={billCustomAmount}
            onChangeText={setBillCustomAmount}
            keyboardType="decimal-pad"
            placeholder="Amount"
            placeholderTextColor={C.muted}
          />
        )}
        <Text style={[s.sheetLabel, { marginTop: 14 }]}>Due in</Text>
        <View style={s.chipRow}>
          {[7, 14, 30].map((d) => (
            <TouchableOpacity
              key={d}
              style={[s.chip, billDueDays === d && s.chipActive]}
              onPress={() => setBillDueDays(d)}
            >
              <Text style={[s.chipText, billDueDays === d && s.chipTextActive]}>{d} days</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={s.infoBox}>
          <Text style={s.infoBoxText}>
            It shows on Home under Owed to You, with a reminder button. When {client || "they"} pays, tap Paid and it counts toward this job.
          </Text>
        </View>
        <TouchableOpacity
          style={[s.sheetSaveBtn, (billSaving || billAmount <= 0) && { opacity: 0.5 }]}
          onPress={handleBillSave}
          disabled={billSaving || billAmount <= 0}
        >
          <Text style={s.sheetSaveBtnText}>
            {billSaving ? "Adding…" : `Add ${fmt(billAmount)} to Owed to You`}
          </Text>
        </TouchableOpacity>
      </BottomSheet>

    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 16, paddingBottom: 48, gap: 18 },

  // Header
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    height: 48,
    paddingHorizontal: 16,
    paddingBottom: 6,
    backgroundColor: C.bg,
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    alignItems: "center", justifyContent: "center",
  },

  // Title
  titleBlock: { gap: 8 },
  title:      { fontSize: 27, fontWeight: "700", color: C.ink, letterSpacing: -0.5 },
  metaRow:    { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  metaMuted:  { fontSize: 14, color: C.muted },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusActive:   { backgroundColor: "#E8EEFC" },
  statusComplete: { backgroundColor: "#E3F2EA" },
  statusDot:  { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 13, fontWeight: "600" },

  // Demo banner
  demoBanner:     { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF3C7", borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: "#FDE68A" },
  demoBannerText: { flex: 1, fontSize: 13, fontWeight: "500", color: "#92400E" },

  // Card
  card: { backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.border, padding: 18 },

  // Profit
  profitLabel:  { fontSize: 13, color: C.muted, marginBottom: 4 },
  profitAmount: { fontSize: 38, fontWeight: "700", color: C.ink, letterSpacing: -0.5 },

  // Empty money
  emptyMoneyBody: { fontSize: 15, color: "#3B3E45", lineHeight: 22, marginTop: 8 },
  dashedBtn:      { marginTop: 14, borderWidth: 1.5, borderColor: C.link, borderStyle: "dashed", borderRadius: 12, paddingVertical: 12, alignItems: "center" },

  // Tiles
  tilesRow:  { flexDirection: "row", gap: 8, marginBottom: 14 },
  tile:      { flex: 1, backgroundColor: C.bg, borderRadius: 14, padding: 12 },
  tileLabel: { fontSize: 13, color: C.muted },
  tileValue: { fontSize: 18, fontWeight: "600", color: C.ink },
  dot:       { width: 8, height: 8, borderRadius: 4 },

  // Job row
  jobRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTopWidth: 1, marginBottom: 8 },

  // Bar
  barTrack: { height: 8, borderRadius: 4, backgroundColor: C.track, overflow: "hidden", marginBottom: 6 },
  barFill:  { height: 8, borderRadius: 4, backgroundColor: C.green },

  // Bill chip
  billChip: { minHeight: 36, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 10, justifyContent: "center" },

  // Billed strip
  billedStrip: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, backgroundColor: "#FFF7ED", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },

  // Action row
  actionRow:          { flexDirection: "row", gap: 10 },
  actionBtn:          { flex: 1, height: 54, borderRadius: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  actionBtnGreen:     { backgroundColor: "#4FB583" },
  actionBtnWhite:     { backgroundColor: C.card, borderWidth: 1, borderColor: "#E3E5EA" },
  actionBtnTextWhite: { fontSize: 15, fontWeight: "700", color: "#fff" },
  actionBtnTextInk:   { fontSize: 15, fontWeight: "700", color: C.ink },

  // Segmented tabs
  tabTrack:         { flexDirection: "row", backgroundColor: "#ECECE7", borderRadius: 12, padding: 3 },
  tabBtn:           { flex: 1, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  tabBtnActive:     { backgroundColor: C.card, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  tabBtnText:       { fontSize: 13, fontWeight: "500", color: C.muted },
  tabBtnTextActive: { fontWeight: "600", color: C.ink },

  // Tab card
  tabCard: { backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.border, paddingVertical: 6, paddingHorizontal: 16, marginBottom: 8 },

  // Tasks
  taskRow:         { flexDirection: "row", alignItems: "flex-start", minHeight: 52, paddingVertical: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: C.divider },
  checkCircle:     { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "#C9C9C2", alignItems: "center", justifyContent: "center", marginTop: 1 },
  checkCircleDone: { backgroundColor: C.green, borderColor: C.green },
  taskName:        { fontSize: 16, color: C.ink },
  taskNameDone:    { color: "#8A8D94", textDecorationLine: "line-through" },
  taskDetails:     { fontSize: 13, color: C.muted, marginTop: 2 },

  // Materials
  materialRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 52, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.divider, backgroundColor: C.card },
  materialName:  { fontSize: 16, color: C.ink },
  materialQty:   { fontSize: 13, color: C.muted },
  deleteAction:  { backgroundColor: "#EF4444", justifyContent: "center", alignItems: "center", width: 72, marginVertical: 4, borderRadius: 12 },

  // Money
  moneyRow:        { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.divider },
  moneyBadge:      { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  moneyBadgeGreen: { backgroundColor: "#E3F2EA" },
  moneyBadgeRed:   { backgroundColor: "#FBEAE0" },
  moneyBadgeText:  { fontSize: 16, fontWeight: "700" },
  moneyTitle:      { fontSize: 15, fontWeight: "500", color: C.ink },
  moneyMeta:       { fontSize: 13, color: C.muted, marginTop: 1 },
  moneyAmount:     { fontSize: 15, fontWeight: "600" },
  downloadZipRow:  { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 14 },

  // Inline add + add row
  addRowBtn:      { paddingVertical: 14 },
  addRowBtnText:  { fontSize: 15, fontWeight: "600", color: C.link },
  inlineAddRow:   { flexDirection: "row", gap: 8, paddingVertical: 8 },
  inlineInput:    { height: 44, backgroundColor: C.bg, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, fontSize: 16, color: C.ink },
  emptyTabText:   { fontSize: 14, color: C.muted, paddingVertical: 20, textAlign: "center" },

  // Modals
  modalBackdrop:          { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  modalCard:              { width: "92%", height: "90%", backgroundColor: "#fff", borderRadius: 24, overflow: "hidden" },
  deleteModal:            { width: "82%", backgroundColor: "#fff", borderRadius: 24, padding: 28, alignItems: "center" },
  deleteModalIcon:        { width: 64, height: 64, borderRadius: 32, backgroundColor: "#FEF2F2", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  deleteModalTitle:       { fontSize: 20, fontWeight: "800", color: "#111827", marginBottom: 10 },
  deleteModalBody:        { fontSize: 14, color: "#6B7280", textAlign: "center", lineHeight: 20, marginBottom: 24 },
  deleteModalConfirm:     { width: "100%", backgroundColor: "#EF4444", borderRadius: 14, paddingVertical: 15, alignItems: "center", marginBottom: 10 },
  deleteModalConfirmText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  deleteModalCancel:      { width: "100%", backgroundColor: "#F3F4F6", borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  deleteModalCancelText:  { color: "#374151", fontSize: 16, fontWeight: "600" },

  // Sheet shared
  sheetMeta:         { fontSize: 13, color: C.muted, marginBottom: 16, textAlign: "center" },
  sheetTitle:        { fontSize: 18, fontWeight: "700", color: C.ink, marginBottom: 8 },
  sheetBody:         { fontSize: 14, color: C.muted, lineHeight: 20, marginBottom: 16 },
  sheetField:        { marginBottom: 12 },
  sheetLabel:        { fontSize: 13, fontWeight: "600", color: C.muted, marginBottom: 6 },
  sheetInput:        { height: 52, backgroundColor: C.bg, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, fontSize: 16, color: C.ink },
  sheetSaveBtn:      { height: 54, borderRadius: 18, backgroundColor: C.ink, alignItems: "center", justifyContent: "center", marginTop: 8 },
  sheetSaveBtnText:  { color: "#fff", fontSize: 16, fontWeight: "700" },
  notSureBtn:        { alignItems: "center", paddingVertical: 14 },
  notSureBtnText:    { fontSize: 14, color: C.muted, fontWeight: "600" },

  // Menu sheet
  menuRow:     { flexDirection: "row", alignItems: "center", gap: 14, height: 54 },
  menuRowText: { fontSize: 16, color: C.ink },
  menuDivider: { height: 1, backgroundColor: C.divider },

  // Job value sheet
  jobValueInputRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  jobValuePrefix:   { fontSize: 30, fontWeight: "700", color: C.ink, marginRight: 6 },
  jobValueInput:    { flex: 1, height: 64, fontSize: 30, fontWeight: "700", color: C.ink, borderBottomWidth: 2, borderBottomColor: C.border },
  jobValueLive:     { backgroundColor: C.bg, borderRadius: 12, padding: 14, gap: 6, marginBottom: 16 },
  jobValueLiveText: { fontSize: 14, color: C.muted },

  // Bill sheet chips
  chipRow:          { flexDirection: "row", gap: 8, marginBottom: 8 },
  chip:             { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, alignItems: "center" },
  chipActive:       { backgroundColor: "#E8EEFC", borderColor: C.link },
  chipText:         { fontSize: 13, color: C.muted },
  chipTextActive:   { fontWeight: "600", color: C.link },
  infoBox:          { backgroundColor: C.bg, borderRadius: 12, padding: 14, marginVertical: 12, borderWidth: 1, borderColor: C.border },
  infoBoxText:      { fontSize: 13, color: C.muted, lineHeight: 19 },
});
