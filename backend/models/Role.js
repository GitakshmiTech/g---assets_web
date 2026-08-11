import mongoose from "mongoose";
import { DEFAULT_ROLE_PERMISSIONS, DEFAULT_ROLE_SIDEBAR } from "../utils/permissionCatalog.js";

export const DEFAULT_ROLES = [
  { key: "SUPER_ADMIN", label: "Super Admin", isSystem: true },
  { key: "COMPANY_ADMIN", label: "Company Admin", isSystem: true },
  { key: "BRANCH_ADMIN", label: "Branch Admin", isSystem: true },
  { key: "ADMIN", label: "Admin", isSystem: true },
  { key: "IT_STAFF", label: "IT Staff", isSystem: true },
  { key: "MANAGER", label: "Manager", isSystem: true },
  { key: "AUDITOR", label: "Auditor", isSystem: true },
  { key: "EMPLOYEE", label: "Employee", isSystem: true },
].map((role) => ({
  ...role,
  sidebarAccess: DEFAULT_ROLE_SIDEBAR[role.key] || [],
  permissions: DEFAULT_ROLE_PERMISSIONS[role.key] || [],
  access: (DEFAULT_ROLE_SIDEBAR[role.key] || []).join(", "),
}));

const roleSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, uppercase: true, trim: true },
    label: { type: String, required: true, trim: true },
    access: { type: String, default: "", trim: true },
    sidebarAccess: [{ type: String, trim: true }],
    permissions: [{ type: String, trim: true }],
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const Role = mongoose.models.Role || mongoose.model("Role", roleSchema);

export const ensureDefaultRoles = async () => {
  await Promise.all(
    DEFAULT_ROLES.map(async (role) => {
      const exists = await Role.findOne({ key: role.key });
      if (!exists) {
        await Role.create({
          key: role.key,
          label: role.label,
          access: role.access,
          sidebarAccess: role.sidebarAccess,
          permissions: role.permissions,
          isSystem: true,
        });
      } else if (exists.isSystem) {
        await Role.updateOne(
          { key: role.key },
          {
            $set: {
              permissions: role.permissions,
              sidebarAccess: role.sidebarAccess,
              access: role.access,
            },
          }
        );
      }
    })
  );
};

export default Role;
