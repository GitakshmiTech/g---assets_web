import Asset from "../models/Asset.js";
import User from "../models/User.js";
import QRCode from "qrcode";
import crypto from "crypto";
import {
  cleanUrl,
  getLanIpv4,
  isValidHttpUrl,
  resolveScanBaseUrl,
} from "../utils/networkUrl.js";
import { PERMISSIONS } from "../utils/permissionCatalog.js";

const getCompanyIdString = (companyId) => {
  if (!companyId) return "";
  if (typeof companyId === "object" && companyId._id) return String(companyId._id);
  return String(companyId);
};

const normalizeStatus = (status) => {
  const normalized = String(status || "AVAILABLE").toUpperCase().replace(/\s+/g, "_");
  const statusMap = {
    AVAILABLE: "AVAILABLE",
    ASSIGNED: "ASSIGNED",
    REPAIR: "UNDER_REPAIR",
    UNDER_REPAIR: "UNDER_REPAIR",
    RETURNED: "RETURNED",
    DAMAGED: "DAMAGED",
    LOST: "LOST",
    RETIRED: "RETIRED",
    DISPOSED: "DISPOSED",
    RECYCLED: "RECYCLED",
  };

  return statusMap[normalized] || "AVAILABLE";
};

const normalizeAssetPayload = (payload) => {
  const data = { ...payload };
  const categoryKind = String(data.categoryKind || "").toUpperCase();
  delete data.categoryKind;

  const legacyNetwork = ["laptop", "pc", "desktop", "computer"].includes(
    String(data.category || "").trim().toLowerCase(),
  );
  const isComputerAsset = categoryKind === "NETWORK" || legacyNetwork;

  if (!isComputerAsset) {
    [
      "ipAddress",
      "macAddress",
      "hostName",
      "networkType",
      "subnet",
      "gateway",
      "operatingSystem",
      "processor",
      "ram",
      "storage",
      "antivirus",
      "domainName",
    ].forEach((key) => {
      data[key] = undefined;
    });
  }

  if (payload.assignedTo !== undefined || payload.assetStatus !== undefined) {
    if (data.assignedTo && data.assignedTo !== "") {
      data.assetStatus = "ASSIGNED";
    } else {
      if (payload.assignedTo !== undefined) {
        data.assignedTo = null;
      }
      if (payload.assetStatus !== undefined && (data.assetStatus === "ASSIGNED" || !data.assetStatus)) {
        data.assetStatus = "AVAILABLE";
      }
    }
  }

  if (data.assetStatus) {
    data.assetStatus = normalizeStatus(data.assetStatus);
  }

  ["warrantyPeriod", "maintenancePeriod", "price", "warrantyReminderDays"].forEach(
    (key) => {
      if (data[key] === "" || data[key] === null) {
        data[key] = undefined;
      } else if (data[key] !== undefined) {
        const val = Number(data[key]);
        data[key] = Number.isNaN(val) ? undefined : val;
      }
    },
  );

  [
    "purchaseDate",
    "warrantyStart",
    "warrantyEnd",
    "assignedDate",
    "expectedReturn",
    "retirementDate",
    "requestDate",
  ].forEach((key) => {
    if (data[key] === "") data[key] = undefined;
  });

  if (data.purchaseDate && data.warrantyPeriod && !data.warrantyEnd) {
    const warrantyEnd = new Date(data.purchaseDate);
    warrantyEnd.setMonth(warrantyEnd.getMonth() + Number(data.warrantyPeriod));
    data.warrantyStart = data.warrantyStart || data.purchaseDate;
    data.warrantyEnd = warrantyEnd;
  }

  if (data.deviceOwnedBy === "Me") {
    data.ownerName = "";
  }

  return data;
};

const appendTimeline = (asset, title, detail) => {
  asset.lifecycleTimeline.push({
    title,
    detail,
    date: new Date(),
  });
};

const getServerUrl = (req) => {
  const scanBaseUrl = resolveScanBaseUrl(req);
  if (scanBaseUrl) return scanBaseUrl;

  const requestHost = req.get("host") || "";
  const protocol = (req.get("x-forwarded-proto") || req.protocol || "http").split(",")[0];

  return cleanUrl(`${protocol}://${requestHost}`);
};

const buildQrUrl = (asset, req) => {
  const scanBaseUrl = resolveScanBaseUrl(req);
  return `${scanBaseUrl}/scan/${asset._id}?t=${asset.qrToken}`;
};

export const getQrScanBaseUrl = async (req, res) => {
  try {
    const scanBaseUrl = resolveScanBaseUrl(req);

    res.status(200).json({
      success: true,
      scanBaseUrl,
      lanIp: getLanIpv4(),
      sampleScanUrl: `${scanBaseUrl}/scan/{assetId}?t={token}`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const attachRequestedByPhoto = async (assetOrAssets) => {
  try {
    const isArray = Array.isArray(assetOrAssets);
    const assets = isArray ? assetOrAssets : [assetOrAssets];
    
    const users = await User.find({ status: "ACTIVE" }, "name email username profilePhoto").lean();
    const userMapByEmail = {};
    const userMapByUsername = {};
    const userMapByName = {};
    users.forEach(u => {
      if (u.email) userMapByEmail[u.email.toLowerCase()] = u.profilePhoto || "";
      if (u.username) userMapByUsername[u.username.toLowerCase()] = u.profilePhoto || "";
      if (u.name) userMapByName[u.name.toLowerCase()] = u.profilePhoto || "";
    });

    const mapped = assets.map(asset => {
      const doc = asset.toObject ? asset.toObject() : asset;
      let photo = "";
      if (doc.employeeEmail) {
        photo = userMapByEmail[doc.employeeEmail.toLowerCase()];
      }
      if (!photo && doc.requestedBy) {
        photo = userMapByUsername[doc.requestedBy.toLowerCase()] || userMapByName[doc.requestedBy.toLowerCase()];
      }
      return {
        ...doc,
        requestedByPhoto: photo || ""
      };
    });

    return isArray ? mapped : mapped[0];
  } catch (error) {
    console.error("Error attaching user profile photo:", error);
    return assetOrAssets;
  }
};

const generateQrCode = async (asset, req) => {
  const qrUrl = buildQrUrl(asset, req);
  return QRCode.toDataURL(qrUrl, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 300,
  });
};

const getWarrantyDays = (asset) => {
  if (!asset.warrantyEnd) return null;
  return Math.ceil((new Date(asset.warrantyEnd) - new Date()) / 86400000);
};

const getRepairCost = (asset) =>
  asset.repairHistory?.reduce((sum, item) => sum + Number(item.repairCost || 0), 0) || 0;

const addDays = (date, days) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
};

const groupCount = (items, key) =>
  items.reduce((acc, item) => {
    const value = item[key] || "Unassigned";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});

const groupRepairCost = (items, key) =>
  items.reduce((acc, asset) => {
    const value = asset[key] || "Unassigned";
    acc[value] = (acc[value] || 0) + getRepairCost(asset);
    return acc;
  }, {});

const escapeHtml = (value = "") =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("en-IN");
};

const detailRow = (label, value) => `
  <div class="detail-row">
    <dt>${escapeHtml(label)}</dt>
    <dd>${escapeHtml(value || "-")}</dd>
  </div>`;

const renderScanAssetPage = (asset) => {
  const warrantyDays = getWarrantyDays(asset);
  const warrantyText =
    warrantyDays === null
      ? "-"
      : warrantyDays < 0
        ? `Expired ${Math.abs(warrantyDays)} days ago`
        : `${warrantyDays} days remaining`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(asset.assetName || "Asset Details")}</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: Arial, Helvetica, sans-serif;
        background: #f4f7fb;
        color: #172033;
      }
      .page {
        width: min(920px, 100%);
        margin: 0 auto;
        padding: 24px 16px 40px;
      }
      .header {
        background: #0f5f8f;
        color: #fff;
        border-radius: 8px;
        padding: 22px;
        margin-bottom: 16px;
      }
      .eyebrow {
        margin: 0 0 8px;
        font-size: 12px;
        letter-spacing: .08em;
        text-transform: uppercase;
        opacity: .82;
      }
      h1 {
        margin: 0;
        font-size: 28px;
        line-height: 1.2;
      }
      .code {
        display: inline-block;
        margin-top: 12px;
        padding: 6px 10px;
        border-radius: 6px;
        background: rgba(255,255,255,.16);
        font-weight: 700;
      }
      .status {
        margin-top: 12px;
        font-weight: 700;
      }
      .section {
        background: #fff;
        border: 1px solid #dce5ef;
        border-radius: 8px;
        padding: 18px;
        margin-top: 14px;
      }
      h2 {
        margin: 0 0 14px;
        font-size: 18px;
      }
      dl {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
        margin: 0;
      }
      .detail-row {
        border-bottom: 1px solid #edf1f5;
        padding-bottom: 10px;
      }
      dt {
        color: #607083;
        font-size: 12px;
        margin-bottom: 4px;
      }
      dd {
        margin: 0;
        font-weight: 700;
        overflow-wrap: anywhere;
      }
      @media (max-width: 640px) {
        .page { padding: 14px; }
        .header { padding: 18px; }
        h1 { font-size: 23px; }
        dl { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="header">
        <p class="eyebrow">QR Scan Details</p>
        <h1>${escapeHtml(asset.assetName || "Asset")}</h1>
        <div class="code">${escapeHtml(asset.assetCode || asset._id)}</div>
        <div class="status">Status: ${escapeHtml(asset.assetStatus || "-")}</div>
      </section>

      <section class="section">
        <h2>Asset Information</h2>
        <dl>
          ${detailRow("Category", asset.category)}
          ${detailRow("Type", asset.assetType)}
          ${detailRow("Serial Number", asset.serialNumber)}
          ${detailRow("Model", asset.model)}
          ${detailRow("Manufacturer", asset.manufacturer)}
          ${detailRow("Office", asset.officeName)}
          ${detailRow("Department", asset.department)}
          ${detailRow("Assigned To", asset.assignedTo)}
        </dl>
      </section>

      <section class="section">
        <h2>Purchase & Warranty</h2>
        <dl>
          ${detailRow("Purchase Date", formatDate(asset.purchaseDate))}
          ${detailRow("Warranty Start", formatDate(asset.warrantyStart))}
          ${detailRow("Warranty End", formatDate(asset.warrantyEnd))}
          ${detailRow("Warranty Status", warrantyText)}
          ${detailRow("Maintenance Due", formatDate(asset.maintenanceDueDate))}
          ${detailRow("Price", asset.price ? `₹${asset.price}` : "-")}
        </dl>
      </section>

      <section class="section">
        <h2>Network Details</h2>
        <dl>
          ${detailRow("IP Address", asset.ipAddress)}
          ${detailRow("MAC Address", asset.macAddress)}
          ${detailRow("Host Name", asset.hostName)}
          ${detailRow("Operating System", asset.operatingSystem)}
        </dl>
      </section>
    </main>
  </body>
</html>`;
};

export const getAllAssets = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role !== "SUPER_ADMIN" && req.user.companyId) {
      filter.companyId = req.user.companyId;
    }
    const assets = await Asset.find(filter).populate("assignedTo", "name email department employeeId profilePhoto").sort({ createdAt: -1 });
    const assetsWithPhotos = await attachRequestedByPhoto(assets);

    res.status(200).json({
      success: true,
      count: assetsWithPhotos.length,
      assets: assetsWithPhotos,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const createAsset = async (req, res) => {
  try {
    const data = normalizeAssetPayload(req.body);
    const isRequestRecord = data.recordType === "REQUEST";

    if (isRequestRecord && !req.hasPermission?.(PERMISSIONS.REQUEST_CREATE)) {
      return res.status(403).json({ success: false, message: "Permission denied" });
    }

    if (!isRequestRecord && !req.hasPermission?.(PERMISSIONS.ASSET_CREATE)) {
      return res.status(403).json({ success: false, message: "Permission denied" });
    }

    if (
      data.deviceOwnedBy === "Other" &&
      (!data.ownerName || data.ownerName.trim() === "")
    ) {
      return res.status(400).json({
        success: false,
        message: "Owner Name is required",
      });
    }
    if (isRequestRecord) {
      data.requestedBy = data.requestedBy || req.user?.name || req.user?.username || "";
      data.employeeEmail = data.employeeEmail || req.user?.email || "";
      data.employeeId = data.employeeId || req.user?.employeeId || "";
    }
    
    if (req.user.role !== "SUPER_ADMIN" && req.user.companyId) {
      data.companyId = req.user.companyId;
    }

    data.qrToken = crypto.randomBytes(16).toString("hex");
    data.lifecycleTimeline = [
      {
        title: "Asset Registered",
        detail: `${data.assetName} was registered in inventory.`,
        date: new Date(),
      },
    ];

    if (data.assetStatus === "ASSIGNED" && data.assignedTo) {
      data.lifecycleTimeline.push({
        title: "Asset Assigned",
        detail: `Assigned to ${data.assignedTo}.`,
        date: new Date(data.assignedDate || Date.now()),
      });
    }

    const asset = await Asset.create(data);
    if (asset.recordType !== "REQUEST") {
      asset.qrCode = await generateQrCode(asset, req);
    }
    await asset.save();
    await asset.populate("assignedTo", "name email department employeeId profilePhoto");
    
    const resolvedAsset = await attachRequestedByPhoto(asset);
    res.status(201).json({
      success: true,
      asset: resolvedAsset,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const getDashboard = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role !== "SUPER_ADMIN" && req.user.companyId) {
      filter.companyId = req.user.companyId;
    }
    const assets = await Asset.find(filter).sort({ createdAt: -1 });
    const warrantyAlerts = assets.filter((asset) => {
      const days = getWarrantyDays(asset);
      return days !== null && days >= 0 && days <= Number(asset.warrantyReminderDays || 10);
    });
    const expiredWarranties = assets.filter((asset) => {
      const days = getWarrantyDays(asset);
      return days !== null && days < 0;
    });
    const repairTickets = assets.flatMap((asset) =>
      (asset.repairHistory || []).map((ticket) => ({
        ...ticket.toObject(),
        assetId: asset._id,
        assetName: asset.assetName,
        assetCode: asset.assetCode,
        officeName: asset.officeName,
      })),
    );
    const auditPending = assets.filter(
      (asset) => !asset.auditLogs?.length || asset.auditLogs[asset.auditLogs.length - 1]?.physicalStatus !== "Verified",
    );

    res.status(200).json({
      success: true,
      stats: {
        totalAssets: assets.length,
        availableAssets: assets.filter((asset) => asset.assetStatus === "AVAILABLE").length,
        assignedAssets: assets.filter((asset) => asset.assetStatus === "ASSIGNED").length,
        underRepairAssets: assets.filter((asset) => asset.assetStatus === "UNDER_REPAIR").length,
        retiredAssets: assets.filter((asset) => ["RETIRED", "DISPOSED", "RECYCLED"].includes(asset.assetStatus)).length,
        warrantyAlerts: warrantyAlerts.length,
        expiredWarranties: expiredWarranties.length,
        openRepairTickets: repairTickets.filter((ticket) => ticket.status !== "COMPLETED").length,
        auditPending: auditPending.length,
        totalRepairCost: assets.reduce((sum, asset) => sum + getRepairCost(asset), 0),
      },
      charts: {
        status: groupCount(assets, "assetStatus"),
        category: groupCount(assets, "category"),
        office: groupCount(assets, "officeName"),
        department: groupCount(assets, "department"),
        repairCostByOffice: groupRepairCost(assets, "officeName"),
        repairCostByVendor: repairTickets.reduce((acc, ticket) => {
          const vendor = ticket.vendorName || "Unassigned";
          acc[vendor] = (acc[vendor] || 0) + Number(ticket.repairCost || 0);
          return acc;
        }, {}),
      },
      recentActivities: assets
        .flatMap((asset) =>
          (asset.lifecycleTimeline || []).map((event) => ({
            ...event.toObject?.() || event,
            assetName: asset.assetName,
            assetCode: asset.assetCode,
          })),
        )
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 12),
      notifications: [
        ...warrantyAlerts.map((asset) => ({
          type: "Warranty Expiry",
          message: `${asset.assetCode || asset.assetName} warranty expires in ${getWarrantyDays(asset)} days`,
          assetId: asset._id,
        })),
        ...auditPending.slice(0, 10).map((asset) => ({
          type: "Audit Pending",
          message: `${asset.assetCode || asset.assetName} needs physical verification`,
          assetId: asset._id,
        })),
      ],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const getAsset = async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id).populate("assignedTo", "name email department employeeId profilePhoto");

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: "Asset not found",
      });
    }

    if (req.user.role !== "SUPER_ADMIN" && req.user.companyId && getCompanyIdString(asset.companyId) !== getCompanyIdString(req.user.companyId)) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this asset",
      });
    }

    let qrUpdated = false;
    if (!asset.qrToken) {
      asset.qrToken = crypto.randomBytes(16).toString("hex");
      qrUpdated = true;
    }
    if (asset.recordType !== "REQUEST" && !asset.qrCode) {
      asset.qrCode = await generateQrCode(asset, req);
      qrUpdated = true;
    }
    if (qrUpdated) {
      await asset.save();
    }

    const resolvedAsset = await attachRequestedByPhoto(asset);
    res.status(200).json(resolvedAsset);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const updateAsset = async (req, res) => {
  try {
    const data = normalizeAssetPayload(req.body);

    if (
      data.deviceOwnedBy === "Other" &&
      (!data.ownerName || data.ownerName.trim() === "")
    ) {
      return res.status(400).json({
        success: false,
        message: "Owner Name is required",
      });
    }

    const asset = await Asset.findById(req.params.id);

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: "Asset not found",
      });
    }

    if (req.user.role !== "SUPER_ADMIN" && req.user.companyId && getCompanyIdString(asset.companyId) !== getCompanyIdString(req.user.companyId)) {
      return res.status(403).json({
        success: false,
        message: "Access denied to update this asset",
      });
    }

    const approvalKeys = ["managerApproval", "adminApproval", "requestStatus"];
    const auditKeys = ["auditLogs", "lifecycleTimeline"];
    const payloadKeys = Object.keys(data).filter((key) => data[key] !== undefined);
    const approvalOnly = payloadKeys.length > 0 && payloadKeys.every((key) => approvalKeys.includes(key));
    const auditOnly = payloadKeys.length > 0 && payloadKeys.every((key) => auditKeys.includes(key));
    const hasRejectedValue = [data.managerApproval, data.adminApproval, data.requestStatus].includes("Rejected");
    const isRequestRecord = asset.recordType === "REQUEST" || data.recordType === "REQUEST";

    if (isRequestRecord && approvalOnly) {
      const requiredPermission = hasRejectedValue ? PERMISSIONS.REQUEST_REJECT : PERMISSIONS.REQUEST_APPROVE;
      if (!req.hasPermission?.(requiredPermission)) {
        return res.status(403).json({ success: false, message: "Permission denied" });
      }
    } else if (auditOnly) {
      if (!req.hasPermission?.(PERMISSIONS.AUDIT_MANAGE) && !req.hasPermission?.(PERMISSIONS.AUDIT_VIEW)) {
        return res.status(403).json({ success: false, message: "Permission denied" });
      }
    } else if (data.assignedTo !== undefined || data.assignedDate !== undefined || data.employeeId !== undefined) {
      if (!req.hasPermission?.(PERMISSIONS.ASSET_ASSIGN)) {
        return res.status(403).json({ success: false, message: "Permission denied" });
      }
    } else if (!req.hasPermission?.(PERMISSIONS.ASSET_EDIT)) {
      return res.status(403).json({ success: false, message: "Permission denied" });
    }

    const previousStatus = asset.assetStatus;
    const previousAssignedTo = asset.assignedTo;
    const previousManagerApproval = asset.managerApproval;
    const previousAdminApproval = asset.adminApproval;
    Object.assign(asset, data);

    if (!asset.qrToken) {
      asset.qrToken = crypto.randomBytes(16).toString("hex");
    }

    if (data.assetStatus && data.assetStatus !== previousStatus) {
      appendTimeline(
        asset,
        `Status Changed To ${data.assetStatus}`,
        `Asset status moved from ${previousStatus || "UNKNOWN"} to ${data.assetStatus}.`,
      );
    }

    if (data.assignedTo && data.assignedTo !== previousAssignedTo) {
      appendTimeline(asset, "Asset Assigned", `Assigned to ${data.assignedTo}.`);
    }

    if (
      asset.managerApproval === "Approved" &&
      previousManagerApproval !== "Approved"
    ) {
      appendTimeline(
        asset,
        "Manager Approved Request",
        `Request ${asset.requestId || asset.assetName || ""} approved by manager.`,
      );
    }

    if (
      asset.managerApproval === "Rejected" &&
      previousManagerApproval !== "Rejected"
    ) {
      appendTimeline(
        asset,
        "Manager Rejected Request",
        `Request ${asset.requestId || asset.assetName || ""} rejected by manager.`,
      );
    }

    if (
      asset.adminApproval === "Approved" &&
      previousAdminApproval !== "Approved"
    ) {
      appendTimeline(
        asset,
        "IT/Admin Approved Request",
        `Request ${asset.requestId || asset.assetName || ""} approved by IT/Admin.`,
      );
    }

    if (
      asset.adminApproval === "Rejected" &&
      previousAdminApproval !== "Rejected"
    ) {
      appendTimeline(
        asset,
        "IT/Admin Rejected Request",
        `Request ${asset.requestId || asset.assetName || ""} rejected by IT/Admin.`,
      );
    }

    if (asset.recordType !== "REQUEST") {
      asset.qrCode = await generateQrCode(asset, req);
    }

    const updatedAsset = await asset.save();
    await updatedAsset.populate("assignedTo", "name email department employeeId profilePhoto");
    const resolvedAsset = await attachRequestedByPhoto(updatedAsset);

    res.status(200).json({
      success: true,
      message: "Asset updated successfully",
      asset: resolvedAsset,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const createWorkflowEvent = async (req, res) => {
  try {
    const { workflow } = req.params;
    const data = normalizeAssetPayload(req.body);
    const asset = await Asset.findById(req.params.id);

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: "Asset not found",
      });
    }

    if (workflow === "repair") {
      asset.repairHistory.push(data);
      asset.assetStatus = data.status === "COMPLETED" ? "AVAILABLE" : "UNDER_REPAIR";
      appendTimeline(asset, `Repair ${data.status || "OPEN"}`, `${data.issue || "Issue"} recorded.`);
    } else if (workflow === "transfer") {
      asset.transferHistory.push(data);
      if (data.toEmployee) asset.assignedTo = data.toEmployee;
      if (data.toOffice) asset.officeName = data.toOffice;
      if (data.transferType === "Return Asset") asset.assetStatus = data.physicalStatus || "RETURNED";
      appendTimeline(asset, data.transferType || "Asset Transfer", `Moved to ${data.toEmployee || data.toOffice || "inventory"}.`);
    } else if (workflow === "audit") {
      asset.auditLogs.push(data);
      appendTimeline(asset, "Audit Verification", `${data.physicalStatus || "Verified"} by ${data.verifiedBy || "Auditor"}.`);
    } else if (workflow === "retire") {
      asset.assetStatus = data.retirementStatus || "RETIRED";
      asset.retirementStatus = data.retirementStatus || "RETIRED";
      asset.retirementApproval = data.retirementApproval || asset.retirementApproval;
      asset.disposalMethod = data.disposalMethod || asset.disposalMethod;
      asset.retirementDate = data.retirementDate || new Date();
      appendTimeline(asset, "Asset Retirement", `${asset.assetStatus} through ${asset.disposalMethod || "standard disposal"}.`);
    } else {
      return res.status(400).json({
        success: false,
        message: "Unsupported workflow",
      });
    }

    const updatedAsset = await asset.save();

    res.status(200).json({
      success: true,
      asset: updatedAsset,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const getReports = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role !== "SUPER_ADMIN" && req.user.companyId) {
      filter.companyId = req.user.companyId;
    }
    const assets = await Asset.find(filter).sort({ createdAt: -1 });
    const repairTickets = assets.flatMap((asset) =>
      (asset.repairHistory || []).map((ticket) => ({
        ...ticket.toObject(),
        assetName: asset.assetName,
        assetCode: asset.assetCode,
        officeName: asset.officeName,
      })),
    );

    res.status(200).json({
      success: true,
      assetReports: {
        totalAssets: assets.length,
        availableAssets: assets.filter((asset) => asset.assetStatus === "AVAILABLE"),
        assignedAssets: assets.filter((asset) => asset.assetStatus === "ASSIGNED"),
        categoryWiseAssets: groupCount(assets, "category"),
        officeWiseAssets: groupCount(assets, "officeName"),
      },
      repairReports: {
        monthlyRepairCost: repairTickets.reduce((acc, ticket) => {
          const month = ticket.repairDate
            ? new Date(ticket.repairDate).toLocaleString("en-US", { month: "short", year: "numeric" })
            : "Unscheduled";
          acc[month] = (acc[month] || 0) + Number(ticket.repairCost || 0);
          return acc;
        }, {}),
        mostRepairedAssets: assets
          .map((asset) => ({
            assetId: asset._id,
            assetName: asset.assetName,
            assetCode: asset.assetCode,
            repairs: asset.repairHistory?.length || 0,
            cost: getRepairCost(asset),
          }))
          .sort((a, b) => b.repairs - a.repairs),
        vendorWiseRepairs: repairTickets.reduce((acc, ticket) => {
          const vendor = ticket.vendorName || "Unassigned";
          acc[vendor] = (acc[vendor] || 0) + Number(ticket.repairCost || 0);
          return acc;
        }, {}),
      },
      warrantyReports: {
        expiringWarranties: assets.filter((asset) => {
          const days = getWarrantyDays(asset);
          return days !== null && days >= 0 && days <= Number(asset.warrantyReminderDays || 10);
        }),
        expiredWarranties: assets.filter((asset) => {
          const days = getWarrantyDays(asset);
          return days !== null && days < 0;
        }),
      },
      officeReports: {
        officeWiseAssetCount: groupCount(assets, "officeName"),
        officeWiseRepairCost: groupRepairCost(assets, "officeName"),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const getScanAsset = async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id).populate("assignedTo", "name email department employeeId profilePhoto");
    const wantsHtml = req.accepts(["html", "json"]) === "html";

    if (!asset || asset.qrToken !== req.query.t) {
      if (wantsHtml) {
        return res.status(404).send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Invalid QR Code</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: Arial, Helvetica, sans-serif; background: #f4f7fb; color: #172033; }
      main { width: min(520px, calc(100% - 28px)); background: #fff; border: 1px solid #dce5ef; border-radius: 8px; padding: 24px; text-align: center; }
      h1 { margin: 0 0 10px; font-size: 24px; }
      p { margin: 0; color: #607083; }
    </style>
  </head>
  <body>
    <main>
      <h1>Invalid or expired QR code</h1>
      <p>Please ask the asset team to refresh this QR code.</p>
    </main>
  </body>
</html>`);
      }

      return res.status(404).json({
        success: false,
        message: "Invalid or expired QR code",
      });
    }

    if (wantsHtml) {
      const scanBase = resolveScanBaseUrl(req);
      const token = encodeURIComponent(req.query.t || "");
      return res.redirect(302, `${scanBase}/scan/${asset._id}?t=${token}`);
    }

    res.status(200).json(asset);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const refreshQrCodes = async (req, res) => {
  try {
    const assets = await Asset.find();

    for (const asset of assets) {
      if (!asset.qrToken) {
        asset.qrToken = crypto.randomBytes(16).toString("hex");
      }

      asset.assetStatus = normalizeStatus(asset.assetStatus);
      asset.qrCode = await generateQrCode(asset, req);
      await asset.save();
    }

    const scanBaseUrl = resolveScanBaseUrl(req);

    res.status(200).json({
      success: true,
      message: "QR codes refreshed successfully",
      clientUrl: scanBaseUrl,
      scannerUrl: scanBaseUrl,
      lanIp: getLanIpv4(),
      count: assets.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      error: error.message,
    });
  }
};

export const seedWorkflowDemoData = async (req, res) => {
  try {
    const today = new Date();
    const demoAssets = [
      {
        assetName: "Demo Dell Latitude - Warranty Expiring",
        category: "Laptop",
        subCategory: "Business Laptop",
        assetStatus: "ASSIGNED",
        assignedTo: "Rahul Sharma",
        assignedBy: "IT Admin",
        assignedDate: addDays(today, -35),
        serialNumber: "DEMO-DLL-1001",
        assetCode: "DEMO-WAR-001",
        brand: "Dell",
        model: "Latitude 5440",
        purchaseDate: addDays(today, -355),
        vendor: "Dell India",
        location: "Ahmedabad",
        assetType: "Laptop",
        warrantyPeriod: 12,
        maintenancePeriod: 3,
        price: 65000,
        invoiceNumber: "DEMO-INV-1001",
        warrantyStart: addDays(today, -355),
        warrantyEnd: addDays(today, 7),
        warrantyReminderDays: 15,
        officeName: "GT Ahmedabad",
        branchCode: "AMD001",
        floor: "3rd Floor",
        department: "HR",
        room: "Cabin 302",
        city: "Ahmedabad",
        state: "Gujarat",
        officeContactPerson: "Rahul",
        officePhone: "9876543210",
        assetDescription: "Demo asset for warranty-expiry testing.",
        deviceOwnedBy: "Me",
        repairHistory: [
          {
            ticketId: "DEMO-TKT-101",
            issue: "Keyboard Issue",
            priority: "High",
            description: "Keys not working properly.",
            repairDate: addDays(today, -18),
            returnDate: addDays(today, -16),
            repairCost: 2500,
            repairDetails: "Keyboard replaced",
            vendorName: "Dell Service Center",
            invoiceNumber: "DEMO-REP-220",
            status: "COMPLETED",
            updatedBy: "IT Admin",
          },
        ],
      },
      {
        assetName: "Demo HP Monitor - Under Repair",
        category: "Monitor",
        subCategory: "LED Monitor",
        assetStatus: "UNDER_REPAIR",
        assignedTo: "Amit Patel",
        assignedBy: "IT Admin",
        assignedDate: addDays(today, -70),
        serialNumber: "DEMO-HP-2002",
        assetCode: "DEMO-REP-002",
        brand: "HP",
        model: "E24 G5",
        purchaseDate: addDays(today, -620),
        vendor: "HP India",
        location: "Mumbai",
        assetType: "Monitor",
        warrantyPeriod: 24,
        maintenancePeriod: 6,
        price: 18000,
        invoiceNumber: "DEMO-INV-2002",
        warrantyStart: addDays(today, -620),
        warrantyEnd: addDays(today, 110),
        warrantyReminderDays: 30,
        officeName: "GT Mumbai",
        branchCode: "MUM001",
        floor: "2nd Floor",
        department: "Finance",
        room: "Bay 204",
        city: "Mumbai",
        state: "Maharashtra",
        officeContactPerson: "Amit",
        officePhone: "9123456780",
        assetDescription: "Demo asset for open repair ticket testing.",
        deviceOwnedBy: "Me",
        repairHistory: [
          {
            ticketId: "DEMO-TKT-202",
            issue: "Screen Flickering",
            priority: "Medium",
            description: "Display flickers every few minutes.",
            repairDate: today,
            repairCost: 0,
            repairDetails: "Sent to vendor for diagnosis",
            vendorName: "HP Service",
            invoiceNumber: "",
            status: "UNDER_REPAIR",
            updatedBy: "IT Staff",
          },
        ],
      },
      {
        assetName: "Demo Canon Printer - Warranty Expired",
        category: "Printer",
        subCategory: "Laser Printer",
        assetStatus: "AVAILABLE",
        serialNumber: "DEMO-CAN-3003",
        assetCode: "DEMO-EXP-003",
        brand: "Canon",
        model: "LBP 2900",
        purchaseDate: addDays(today, -900),
        vendor: "Canon Partner",
        location: "Ahmedabad",
        assetType: "Printer",
        warrantyPeriod: 12,
        maintenancePeriod: 2,
        price: 12000,
        invoiceNumber: "DEMO-INV-3003",
        warrantyStart: addDays(today, -900),
        warrantyEnd: addDays(today, -535),
        warrantyReminderDays: 10,
        officeName: "GT Ahmedabad",
        branchCode: "AMD001",
        floor: "1st Floor",
        department: "Admin",
        room: "Store",
        city: "Ahmedabad",
        state: "Gujarat",
        officeContactPerson: "Admin Desk",
        officePhone: "9988776655",
        assetDescription: "Demo asset for expired warranty and maintenance due testing.",
        deviceOwnedBy: "Me",
        repairHistory: [],
      },
    ];

    const savedAssets = [];

    for (const demoAsset of demoAssets) {
      const existingAsset = await Asset.findOne({ assetCode: demoAsset.assetCode });
      const timeline = [
        {
          title: "Demo Data Loaded",
          detail: "Warranty and maintenance demo record prepared.",
          date: today,
        },
      ];

      let asset;
      if (existingAsset) {
        Object.assign(existingAsset, demoAsset, {
          assetStatus: normalizeStatus(demoAsset.assetStatus),
          lifecycleTimeline: [...(existingAsset.lifecycleTimeline || []), ...timeline],
        });
        asset = existingAsset;
      } else {
        asset = new Asset({
          ...demoAsset,
          assetStatus: normalizeStatus(demoAsset.assetStatus),
          qrToken: crypto.randomBytes(16).toString("hex"),
          lifecycleTimeline: timeline,
        });
      }

      if (!asset.qrToken) {
        asset.qrToken = crypto.randomBytes(16).toString("hex");
      }

      asset.qrCode = await generateQrCode(asset, req);
      savedAssets.push(await asset.save());
    }

    res.status(200).json({
      success: true,
      message: "Demo warranty and maintenance data loaded",
      count: savedAssets.length,
      assets: savedAssets,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const deleteAsset = async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: "Asset not found",
      });
    }

    if (req.user.role !== "SUPER_ADMIN" && req.user.companyId && getCompanyIdString(asset.companyId) !== getCompanyIdString(req.user.companyId)) {
      return res.status(403).json({
        success: false,
        message: "Access denied to delete this asset",
      });
    }

    const isRequestRecord = asset.recordType === "REQUEST";
    const canDeleteRecord = isRequestRecord
      ? req.hasPermission?.(PERMISSIONS.REQUEST_CREATE) || req.hasPermission?.(PERMISSIONS.ASSET_DELETE)
      : req.hasPermission?.(PERMISSIONS.ASSET_DELETE);

    if (!canDeleteRecord) {
      return res.status(403).json({
        success: false,
        message: "Permission denied",
      });
    }

    const hasRequestDecision =
      isRequestRecord &&
      [
        asset.managerApproval,
        asset.adminApproval,
        asset.requestStatus,
      ].some((value) => ["Approved", "Rejected"].includes(value));

    if (hasRequestDecision) {
      return res.status(403).json({
        success: false,
        message: "Approved or rejected requests cannot be deleted",
      });
    }

    await Asset.deleteOne({ _id: asset._id });

    res.status(200).json({
      success: true,
      message: "Asset deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
