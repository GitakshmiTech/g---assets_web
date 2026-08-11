import User from "../models/User.js";
import Role from "../models/Role.js";
import { verifyToken } from "../utils/authToken.js";
import { DEFAULT_ROLE_PERMISSIONS, DEFAULT_ROLE_SIDEBAR } from "../utils/permissionCatalog.js";

export const authenticate = async (req, res, next) => {
  try {
    const token = req.get("authorization")?.replace(/^Bearer\s+/i, "");
    const payload = verifyToken(token);

    if (!payload?.sub) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const user = await User.findById(payload.sub).populate("companyId");

    if (!user || user.status !== "ACTIVE") {
      return res.status(401).json({ success: false, message: "User is not active" });
    }

    req.user = user;
    const role = await Role.findOne({ key: user.role }).lean();
    req.role = role;
    if (user.hasCustomPermissions) {
      req.permissions = user.permissions || [];
      req.sidebarAccess = user.sidebarAccess || [];
    } else {
      req.permissions = role?.permissions?.length ? role.permissions : DEFAULT_ROLE_PERMISSIONS[user.role] || [];
      req.sidebarAccess = role?.sidebarAccess?.length ? role.sidebarAccess : DEFAULT_ROLE_SIDEBAR[user.role] || [];
    }
    req.hasPermission = (permission) => req.permissions.includes(permission);
    next();
  } catch {
    res.status(401).json({ success: false, message: "Invalid or expired login" });
  }
};

export const allowRoles = (...roles) => (req, res, next) => {
  if (req.user?.role === "SUPER_ADMIN") return next();
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ success: false, message: "Permission denied" });
  }

  next();
};

export const allowPermissions = (...permissions) => (req, res, next) => {
  if (req.user?.role === "SUPER_ADMIN") return next();
  const granted = req.permissions || [];
  if (!permissions.some((permission) => granted.includes(permission))) {
    return res.status(403).json({ success: false, message: "Permission denied" });
  }

  next();
};
