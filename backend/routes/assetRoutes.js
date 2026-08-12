import express from "express";
import {
  createAsset,
  createWorkflowEvent,
  deleteAsset,
  getAllAssets,
  getAsset,
  getDashboard,
  getReports,
  getScanAsset,
  refreshQrCodes,
  getQrScanBaseUrl,
  seedWorkflowDemoData,
  updateAsset,
} from "../controllers/assetController.js";
import { getSuperAdminDashboard as getDashboardStats } from "../controllers/superAdminController.js";
import {
  createCompany,
  deleteCompany,
  getCompanyById as getCompany,
  listCompanies,
  updateCompany,
} from "../controllers/companyController.js";
import { currentUser, login, register, updateProfile, ssoLogin, mfaVerify, getSsoStatus } from "../controllers/authController.js";
import { createRole, deleteRole, listRoles, updateRole } from "../controllers/roleController.js";
import { getUsers, createUser, updateUser, deleteUser, bulkImportUsers } from "../controllers/userController.js";
import {
  createPurchaseOrder,
  getAllPurchaseOrders,
  getPurchaseOrderById,
  updatePurchaseOrderStatus,
} from "../controllers/purchaseOrderController.js";
import { getAllInvoices } from "../controllers/invoiceController.js";
import { listVendors, createVendor } from "../controllers/vendorController.js";
import {
  getAllWorkOrders,
  getWorkOrderById,
  createWorkOrder,
  updateWorkOrder,
} from "../controllers/workOrderController.js";
import {
  assignTravelAssetsFromExpense,
  getAvailableAssetsForTravel,
  postDepreciationForAssets,
} from "../controllers/integrationController.js";
import { authenticateIntegration } from "../middlewares/integrationMiddleware.js";
import { allowPermissions, authenticate, allowRoles } from "../middlewares/authMiddleware.js";
import { PERMISSIONS } from "../utils/permissionCatalog.js";

const router = express.Router();

router.get("/roles", listRoles);
router.post("/roles", authenticate, allowPermissions(PERMISSIONS.USER_MANAGE), createRole);
router.put("/roles/:key", authenticate, allowPermissions(PERMISSIONS.USER_MANAGE), updateRole);
router.delete("/roles/:key", authenticate, allowPermissions(PERMISSIONS.USER_MANAGE), deleteRole);

router.get("/users", authenticate, allowPermissions(PERMISSIONS.USER_MANAGE), getUsers);
router.post("/users", authenticate, allowPermissions(PERMISSIONS.USER_MANAGE), createUser);
router.post("/users/bulk-import", authenticate, allowPermissions(PERMISSIONS.USER_MANAGE), bulkImportUsers);
router.put("/users/:id", authenticate, allowPermissions(PERMISSIONS.USER_MANAGE), updateUser);
router.delete("/users/:id", authenticate, allowPermissions(PERMISSIONS.USER_MANAGE), deleteUser);

router.post("/auth/register", register);
router.post("/auth/login", login);
router.post("/auth/sso-login", ssoLogin);
router.get("/auth/sso/status", getSsoStatus);
router.post("/auth/mfa-verify", mfaVerify);
router.get("/auth/me", authenticate, currentUser);
router.put("/auth/profile/update", authenticate, updateProfile);

router.get("/scan/:id", getScanAsset);
router.get("/qr/scan-base-url", authenticate, getQrScanBaseUrl);
// Cross-product Asset <-> Expense integration routes
router.get("/integrations/travel-assets", authenticate, allowPermissions(PERMISSIONS.ASSET_VIEW, PERMISSIONS.ASSET_ASSIGN), getAvailableAssetsForTravel);
router.post("/integrations/depreciation/post", authenticate, allowPermissions(PERMISSIONS.SYSTEM_SETTINGS, PERMISSIONS.REPORT_EXPORT), postDepreciationForAssets);
router.get("/integrations/expense/available-assets", authenticateIntegration, getAvailableAssetsForTravel);
router.post("/integrations/expense/travel-assignments", authenticateIntegration, assignTravelAssetsFromExpense);

router.get("/assets", authenticate, allowPermissions(PERMISSIONS.ASSET_VIEW, PERMISSIONS.REQUEST_VIEW), getAllAssets);
router.get("/dashboard", authenticate, allowPermissions(PERMISSIONS.DASHBOARD_VIEW), getDashboard);
router.get("/reports", authenticate, allowPermissions(PERMISSIONS.REPORT_VIEW), getReports);
router.post("/qr/refresh", authenticate, allowPermissions(PERMISSIONS.QR_GENERATE), refreshQrCodes);
router.post("/demo/warranty-maintenance", authenticate, allowPermissions(PERMISSIONS.MAINTENANCE_MANAGE), seedWorkflowDemoData);
router.get("/asset/:id", authenticate, allowPermissions(PERMISSIONS.ASSET_VIEW), getAsset);
router.put("/asset/update/:id", authenticate, allowPermissions(PERMISSIONS.ASSET_EDIT, PERMISSIONS.ASSET_ASSIGN, PERMISSIONS.REQUEST_APPROVE, PERMISSIONS.REQUEST_REJECT, PERMISSIONS.AUDIT_MANAGE, PERMISSIONS.AUDIT_VIEW), updateAsset);
router.post("/asset/create", authenticate, allowPermissions(PERMISSIONS.ASSET_CREATE, PERMISSIONS.REQUEST_CREATE), createAsset);
router.post("/asset/:id/workflow/:workflow", authenticate, allowPermissions(PERMISSIONS.AUDIT_MANAGE, PERMISSIONS.MAINTENANCE_MANAGE), createWorkflowEvent);
router.delete("/asset/delete/:id", authenticate, allowPermissions(PERMISSIONS.ASSET_DELETE, PERMISSIONS.REQUEST_CREATE), deleteAsset);

// Purchase Order Routes
router.post("/purchase-orders", authenticate, allowPermissions(PERMISSIONS.PROCUREMENT_MANAGE), createPurchaseOrder);
router.get("/purchase-orders", authenticate, allowPermissions(PERMISSIONS.PROCUREMENT_MANAGE), getAllPurchaseOrders);
router.get("/purchase-orders/:id", authenticate, allowPermissions(PERMISSIONS.PROCUREMENT_MANAGE), getPurchaseOrderById);
router.put("/purchase-orders/:id/status", authenticate, allowPermissions(PERMISSIONS.PROCUREMENT_MANAGE), updatePurchaseOrderStatus);

// Invoice Routes
router.get("/invoices", authenticate, allowPermissions(PERMISSIONS.PROCUREMENT_MANAGE), getAllInvoices);

// Vendor Routes
router.get("/vendors", authenticate, allowPermissions(PERMISSIONS.PROCUREMENT_MANAGE), listVendors);
router.post("/vendors", authenticate, allowPermissions(PERMISSIONS.PROCUREMENT_MANAGE), createVendor);

// Work Order Routes
router.get("/work-orders", authenticate, allowPermissions(PERMISSIONS.WORK_ORDERS_MANAGE, PERMISSIONS.EMPLOYEE_PORTAL), getAllWorkOrders);
router.get("/work-orders/:id", authenticate, allowPermissions(PERMISSIONS.WORK_ORDERS_MANAGE), getWorkOrderById);
router.post("/work-orders", authenticate, allowPermissions(PERMISSIONS.WORK_ORDERS_MANAGE, PERMISSIONS.EMPLOYEE_PORTAL), createWorkOrder);
router.put("/work-orders/:id", authenticate, allowPermissions(PERMISSIONS.WORK_ORDERS_MANAGE), updateWorkOrder);

// Super Admin Routes
router.get("/super-admin/dashboard", authenticate, allowRoles("SUPER_ADMIN"), getDashboardStats);
router.get("/super-admin/company", authenticate, allowRoles("SUPER_ADMIN"), listCompanies);
router.post("/super-admin/company", authenticate, allowRoles("SUPER_ADMIN"), createCompany);
router.get("/super-admin/company/:id", authenticate, allowRoles("SUPER_ADMIN"), getCompany);
router.put("/super-admin/company/:id", authenticate, allowRoles("SUPER_ADMIN"), updateCompany);
router.delete("/super-admin/company/:id", authenticate, allowRoles("SUPER_ADMIN"), deleteCompany);

export default router;
