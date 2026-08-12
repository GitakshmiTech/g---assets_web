import crypto from "crypto";
import mongoose from "mongoose";

export const USER_ROLES = [
  "SUPER_ADMIN",
  "COMPANY_ADMIN",
  "BRANCH_ADMIN",
  "ADMIN",
  "IT_STAFF",
  "MANAGER",
  "AUDITOR",
  "EMPLOYEE",
];

export const normalizeUserRole = (role = "") => {
  const normalized = String(role || "EMPLOYEE").trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (normalized === "SUPERADMIN") return "SUPER_ADMIN";
  return USER_ROLES.includes(normalized) ? normalized : "EMPLOYEE";
};

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    username: {
      type: String,
      lowercase: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    employeeId: {
      type: String,
      trim: true,
    },
    department: {
      type: String,
      trim: true,
    },
    phoneNumber: {
      type: String,
      trim: true,
    },
    profilePhoto: {
      type: String,
      default: "",
    },
    role: {
      type: String,
      default: "EMPLOYEE",
      required: true,
      trim: true,
      uppercase: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    passwordSalt: {
      type: String,
      required: true,
    },
    mfaSecret: {
      type: String,
      default: "",
    },
    mfaEnabled: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
    },
    plainPassword: {
      type: String,
      default: "",
    },
    permissions: {
      type: [String],
      default: [],
    },
    sidebarAccess: {
      type: [String],
      default: [],
    },
    hasCustomPermissions: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

// Compound indexes for multi-tenant data separation per company
userSchema.index({ email: 1, companyId: 1 }, { unique: true });
userSchema.index({ username: 1, companyId: 1 }, { unique: true, sparse: true });
userSchema.index({ employeeId: 1, companyId: 1 }, { unique: true, sparse: true });

userSchema.methods.setPassword = function setPassword(password) {
  this.passwordSalt = crypto.randomBytes(16).toString("hex");
  this.passwordHash = crypto
    .pbkdf2Sync(password, this.passwordSalt, 120000, 64, "sha512")
    .toString("hex");
  this.plainPassword = password;
};

userSchema.methods.verifyPassword = function verifyPassword(password) {
  const incomingHash = crypto
    .pbkdf2Sync(password, this.passwordSalt, 120000, 64, "sha512")
    .toString("hex");

  return crypto.timingSafeEqual(
    Buffer.from(this.passwordHash, "hex"),
    Buffer.from(incomingHash, "hex"),
  );
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  const lastActiveDate = this.updatedAt || this.createdAt;
  const hasPopulatedCompany = this.companyId && typeof this.companyId === "object" && this.companyId.companyName;
  return {
    id: this._id,
    name: this.name,
    username: this.username,
    email: this.email,
    employeeId: this.employeeId,
    role: normalizeUserRole(this.role),
    status: this.status,
    department: this.department,
    phoneNumber: this.phoneNumber,
    profilePhoto: this.profilePhoto,
    companyId: hasPopulatedCompany ? this.companyId._id : this.companyId,
    companyName: hasPopulatedCompany ? this.companyId.companyName : "",
    companyWebsite: hasPopulatedCompany ? this.companyId.website : "",
    companyPhone: hasPopulatedCompany ? this.companyId.phone : "",
    companyIndustry: hasPopulatedCompany ? this.companyId.industry : "",
    branchId: this.branchId,
    permissions: this.permissions || [],
    sidebarAccess: this.sidebarAccess || [],
    hasCustomPermissions: this.hasCustomPermissions || false,
    lastActive: lastActiveDate ? new Date(lastActiveDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" }) : "-",
  };
};

export default mongoose.model("User", userSchema);
