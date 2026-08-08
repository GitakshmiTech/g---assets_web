import WorkOrder from "../models/WorkOrder.js";

const getCompanyIdString = (companyId) => {
  if (!companyId) return "";
  if (typeof companyId === "object" && companyId._id) return String(companyId._id);
  return String(companyId);
};
import { postWorkOrderReimbursement } from "../services/expenseIntegrationService.js";
import mongoose from "mongoose";

export const getAllWorkOrders = async (req, res) => {
  try {
    const { search, product, status } = req.query;
    const query = {};

    if (req.user.role !== "SUPER_ADMIN" && req.user.companyId) {
      query.companyId = req.user.companyId;
    }

    const andConditions = [];

    if (req.user.role === "EMPLOYEE") {
      andConditions.push({ $or: [{ employeeEmail: req.user.email }, { raisedByEmail: req.user.email }] });
    }

    if (status && status !== "ALL") query.status = status;
    if (search) {
      andConditions.push({
        $or: [
          { complaintId: { $regex: search, $options: "i" } },
          { assetId: { $regex: search, $options: "i" } },
          { assetName: { $regex: search, $options: "i" } },
          { complaintType: { $regex: search, $options: "i" } },
          { complaintTitle: { $regex: search, $options: "i" } },
        ]
      });
    }

    if (andConditions.length > 0) {
      query.$and = andConditions;
    }
    if (product) query.assetName = { $regex: product, $options: "i" };
    const workOrders = await WorkOrder.find(query).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: workOrders.length, workOrders });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error: Failed to fetch work orders.", error: error.message });
  }
};

export const getWorkOrderById = async (req, res) => {
  try {
    const workOrder = await WorkOrder.findById(req.params.id);
    if (!workOrder) return res.status(404).json({ success: false, message: "Work Order/Complaint not found." });

    if (req.user.role !== "SUPER_ADMIN" && req.user.companyId && getCompanyIdString(workOrder.companyId) !== getCompanyIdString(req.user.companyId)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    res.status(200).json({ success: true, workOrder });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error: Failed to retrieve work order.", error: error.message });
  }
};

export const createWorkOrder = async (req, res) => {
  try {
    const {
      assetId,
      assetName,
      complaintType,
      complaintTitle,
      priority,
      raisedBy,
      raisedByEmail,
      employeeEmail,
      status,
      assignedTo,
      workOrderSelection,
      workOrderCost,
      invoiceNumber,
      tasks,
      checklists,
      incidentImage,
    } = req.body;

    const count = await WorkOrder.countDocuments();
    const complaintId = `Comp ID - ${count + 1}`;
    const woPayload = {
      complaintId,
      complaintDate: new Date(),
      assetId: assetId || "Asset ID - Unknown",
      assetName: assetName || "Unknown Asset",
      complaintType: complaintType || "Maintenance",
      complaintTitle: complaintTitle || "",
      priority: priority || "Medium",
      raisedBy: raisedBy || req.user?.name || "System",
      raisedByEmail: raisedByEmail || req.user?.email || "",
      employeeEmail: employeeEmail || req.user?.email || "",
      status: status || "Open",
      assignedTo: assignedTo || "",
      workOrderSelection: workOrderSelection || "",
      workOrderCost: workOrderCost || 0,
      invoiceNumber: invoiceNumber || "",
      tasks: tasks || [],
      checklists: checklists || [],
      incidentImage: incidentImage || "",
    };

    if (req.user.role !== "SUPER_ADMIN" && req.user.companyId) {
      woPayload.companyId = req.user.companyId;
    }

    const workOrder = await WorkOrder.create(woPayload);

    // Update corresponding Asset status to UNDER_REPAIR
    if (assetId && assetId !== "Asset ID - Unknown") {
      const Asset = (await import("../models/Asset.js")).default;
      const isMongooseId = mongoose.Types.ObjectId.isValid(assetId);
      const assetQuery = isMongooseId ? { _id: assetId } : { assetCode: assetId };
      await Asset.findOneAndUpdate(
        assetQuery,
        {
          $set: { assetStatus: "UNDER_REPAIR" },
          $push: {
            lifecycleTimeline: {
              title: "Maintenance Initiated",
              detail: `Work order ${complaintId} created: ${complaintTitle}. Asset status set to UNDER_REPAIR.`,
              date: new Date(),
            }
          }
        }
      );
    }

    res.status(201).json({ success: true, message: "Successfully created work order.", workOrder });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error: Failed to create work order.", error: error.message });
  }
};

export const updateWorkOrder = async (req, res) => {
  try {
    const {
      priority,
      assignedTo,
      workOrderSelection,
      workOrderCost,
      invoiceNumber,
      tasks,
      checklists,
      status,
      raisedByEmail,
      employeeEmail,
    } = req.body;

    let workOrder = await WorkOrder.findById(req.params.id);
    if (!workOrder) return res.status(404).json({ success: false, message: "Work Order not found." });

    if (req.user.role !== "SUPER_ADMIN" && req.user.companyId && getCompanyIdString(workOrder.companyId) !== getCompanyIdString(req.user.companyId)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    let computedStatus = status || workOrder.status;
    if (!status && assignedTo && workOrder.status === "Open") computedStatus = "In Progress";

    workOrder = await WorkOrder.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          priority: priority || workOrder.priority,
          assignedTo: assignedTo !== undefined ? assignedTo : workOrder.assignedTo,
          workOrderSelection: workOrderSelection !== undefined ? workOrderSelection : workOrder.workOrderSelection,
          workOrderCost: workOrderCost !== undefined ? Number(workOrderCost) : workOrder.workOrderCost,
          invoiceNumber: invoiceNumber !== undefined ? invoiceNumber : workOrder.invoiceNumber,
          tasks: tasks !== undefined ? tasks : workOrder.tasks,
          checklists: checklists !== undefined ? checklists : workOrder.checklists,
          raisedByEmail: raisedByEmail !== undefined ? raisedByEmail : workOrder.raisedByEmail,
          employeeEmail: employeeEmail !== undefined ? employeeEmail : workOrder.employeeEmail,
          status: computedStatus,
        },
      },
      { new: true, runValidators: true }
    );

    let reimbursementPost = null;
    if (workOrder.status === "Completed") {
      reimbursementPost = await postWorkOrderReimbursement(workOrder);
      if (reimbursementPost) {
        workOrder.expenseIntegration = { ...(workOrder.expenseIntegration || {}), reimbursement: reimbursementPost };
        await workOrder.save();
      }

      // Update the asset status back to ASSIGNED/AVAILABLE
      if (workOrder.assetId && workOrder.assetId !== "Asset ID - Unknown") {
        const Asset = (await import("../models/Asset.js")).default;
        const isMongooseId = mongoose.Types.ObjectId.isValid(workOrder.assetId);
        const assetQuery = isMongooseId ? { _id: workOrder.assetId } : { assetCode: workOrder.assetId };
        
        const asset = await Asset.findOne(assetQuery);
        if (asset) {
          const nextStatus = asset.assignedTo ? "ASSIGNED" : "AVAILABLE";
          asset.assetStatus = nextStatus;
          asset.lifecycleTimeline.push({
            title: "Maintenance Completed",
            detail: `Work order ${workOrder.complaintId} marked Completed. Asset status restored to ${nextStatus}.`,
            date: new Date(),
          });
          await asset.save();
        }
      }
    }

    res.status(200).json({ success: true, message: "Work Order updated successfully.", reimbursementPost, workOrder });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: "Server Error: Failed to update work order.", error: error.message, details: error.data || undefined });
  }
};
