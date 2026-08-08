import PurchaseOrder from "../models/PurchaseOrder.js";

const getCompanyIdString = (companyId) => {
  if (!companyId) return "";
  if (typeof companyId === "object" && companyId._id) return String(companyId._id);
  return String(companyId);
};
import {
  checkPurchaseOrderBudget,
  integrationConfig,
  postPurchaseOrderExpense,
  syncVendorToExpense,
} from "../services/expenseIntegrationService.js";

const generateNextPoNumber = async () => {
  const lastPo = await PurchaseOrder.findOne().sort({ createdAt: -1 });
  if (!lastPo) return "PO-45";
  const match = lastPo.poNumber.match(/PO-(\d+)/);
  return match ? `PO-${parseInt(match[1], 10) + 1}` : "PO-45";
};

export const createPurchaseOrder = async (req, res) => {
  try {
    const { vendor, shippingAddress, products, taxPercent = 18, department = "Operations" } = req.body;

    if (!vendor || !vendor.orgName) {
      return res.status(400).json({ success: false, message: "Vendor organization name is required" });
    }
    if (!shippingAddress || !shippingAddress.addressLine1 || !shippingAddress.city || !shippingAddress.state) {
      return res.status(400).json({ success: false, message: "Valid shipping address is required" });
    }
    if (!products || !products.length) {
      return res.status(400).json({ success: false, message: "At least one product line item is required" });
    }

    let subTotal = 0;
    const validatedProducts = products.map((item) => {
      const quantity = Math.max(1, Number(item.requiredQuantity || 1));
      const unitCost = Math.max(0, Number(item.unitCost || 0));
      const cost = quantity * unitCost;
      subTotal += cost;
      return {
        productName: item.productName,
        requestId: item.requestId || "",
        requiredQuantity: quantity,
        unitCost,
        cost,
      };
    });

    const tax = Math.round((subTotal * (taxPercent / 100)) * 100) / 100;
    const netTotal = subTotal + tax;
    const poNumber = await generateNextPoNumber();
    const raisedBy = req.user?.name || req.user?.username || "Admin";

    const budgetCheck = await checkPurchaseOrderBudget({
      purchaseOrder: { poNumber, netTotal, department, purchaseOrderDate: new Date() },
      department,
    });

    if (!budgetCheck.allowed && integrationConfig.blockOverBudget) {
      return res.status(409).json({
        success: false,
        message: budgetCheck.message || "Purchase order exceeds remaining expense budget",
        budgetCheck,
      });
    }

    const poPayload = {
      poNumber,
      raisedBy,
      vendor,
      shippingAddress,
      products: validatedProducts,
      department,
      budgetCheck,
      subTotal,
      tax,
      netTotal,
      status: "PO Raised",
    };

    if (req.user.role !== "SUPER_ADMIN" && req.user.companyId) {
      poPayload.companyId = req.user.companyId;
    }

    const newPo = await PurchaseOrder.create(poPayload);

    const vendorSync = await syncVendorToExpense(vendor, { poNumber, source: "purchase_order" });
    newPo.expenseIntegration = { ...(newPo.expenseIntegration || {}), vendorSync };
    await newPo.save();

    res.status(201).json({
      success: true,
      message: "Purchase Order raised successfully",
      budgetCheck,
      vendorSync,
      purchaseOrder: newPo,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message,
      details: error.data || undefined,
    });
  }
};

export const getAllPurchaseOrders = async (req, res) => {
  try {
    const { status, search } = req.query;
    const query = {};

    if (req.user.role !== "SUPER_ADMIN" && req.user.companyId) {
      query.companyId = req.user.companyId;
    }

    if (status && status !== "ALL") query.status = status;
    if (search) {
      const searchRegex = new RegExp(search, "i");
      query.$or = [
        { poNumber: searchRegex },
        { raisedBy: searchRegex },
        { "vendor.orgName": searchRegex },
        { "products.productName": searchRegex },
      ];
    }
    const purchaseOrders = await PurchaseOrder.find(query).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: purchaseOrders.length, purchaseOrders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPurchaseOrderById = async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ success: false, message: "Purchase Order not found" });

    if (req.user.role !== "SUPER_ADMIN" && req.user.companyId && getCompanyIdString(po.companyId) !== getCompanyIdString(req.user.companyId)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    res.status(200).json({ success: true, purchaseOrder: po });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updatePurchaseOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["PO Raised", "Received", "Partially Received"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status value" });
    }

    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ success: false, message: "Purchase Order not found" });

    if (req.user.role !== "SUPER_ADMIN" && req.user.companyId && getCompanyIdString(po.companyId) !== getCompanyIdString(req.user.companyId)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    po.status = status;

    let expensePost = null;
    if (["Received", "Partially Received"].includes(status)) {
      expensePost = await postPurchaseOrderExpense(po);
      po.expenseIntegration = { ...(po.expenseIntegration || {}), purchaseExpense: expensePost };
      await po.save();
    }

    res.status(200).json({
      success: true,
      message: "Purchase Order status updated successfully",
      expensePost,
      purchaseOrder: po,
    });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message, details: error.data || undefined });
  }
};