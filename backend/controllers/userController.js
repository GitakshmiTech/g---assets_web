import User from "../models/User.js";

const getCompanyIdString = (companyId) => {
  if (!companyId) return "";
  if (typeof companyId === "object" && companyId._id) return String(companyId._id);
  return String(companyId);
};

// Helper to restrict role assignment based on current user's role
const getAllowedRoles = (currentUserRole) => {
  if (currentUserRole === "SUPER_ADMIN") {
    return ["COMPANY_ADMIN", "BRANCH_ADMIN", "ADMIN", "IT_STAFF", "MANAGER", "AUDITOR", "EMPLOYEE"];
  }
  if (currentUserRole === "COMPANY_ADMIN" || currentUserRole === "ADMIN") {
    return ["IT_STAFF", "MANAGER", "AUDITOR", "EMPLOYEE"];
  }
  return [];
};

export const getUsers = async (req, res) => {
  try {
    const filter = { 
      role: { $ne: "SUPER_ADMIN" },
      _id: { $ne: req.user._id }
    };
    if (req.user.role !== "SUPER_ADMIN" && req.user.companyId) {
      filter.companyId = req.user.companyId;
    }
    const users = await User.find(filter).select("-passwordHash -passwordSalt").sort({ createdAt: -1 });
    res.status(200).json({ success: true, users: users.map(u => u.toSafeJSON()) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createUser = async (req, res) => {
  try {
    const { name, email, department, role, status, password, employeeId } = req.body;
    
    if (!name || !email || !role || !password) {
      return res.status(400).json({ success: false, message: "Name, email, role, and password are required" });
    }

    const allowedRoles = getAllowedRoles(req.user.role);
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ success: false, message: `You are not authorized to create a user with the role ${role}` });
    }

    const existingUser = await User.findOne({ email: String(email).toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ success: false, message: "Email is already registered" });
    }

    if (employeeId) {
      const existingEmployeeId = await User.findOne({ employeeId });
      if (existingEmployeeId) {
        return res.status(409).json({ success: false, message: "Employee ID is already in use" });
      }
    }

    const user = new User({
      name,
      email,
      department,
      role,
      status: String(status || "ACTIVE").toUpperCase(),
      employeeId: employeeId || "",
    });

    if (req.user.role !== "SUPER_ADMIN" && req.user.companyId) {
      user.companyId = req.user.companyId;
    }

    user.setPassword(password);
    await user.save();

    res.status(201).json({ success: true, message: "User created successfully", user: user.toSafeJSON() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, department, role, status, password, employeeId } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (req.user.role !== "SUPER_ADMIN" && getCompanyIdString(user.companyId) !== getCompanyIdString(req.user.companyId)) {
      return res.status(403).json({ success: false, message: "Unauthorized to update this user" });
    }

    if (role && role !== user.role) {
      const allowedRoles = getAllowedRoles(req.user.role);
      if (!allowedRoles.includes(role)) {
        return res.status(403).json({ success: false, message: `You are not authorized to assign the role ${role}` });
      }
      user.role = role;
    }

    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email: String(email).toLowerCase() });
      if (existingUser) {
        return res.status(409).json({ success: false, message: "Email is already in use" });
      }
      user.email = email;
    }

    if (employeeId && employeeId !== user.employeeId) {
      const existingEmployeeId = await User.findOne({ employeeId });
      if (existingEmployeeId) {
        return res.status(409).json({ success: false, message: "Employee ID is already in use" });
      }
      user.employeeId = employeeId;
    }

    if (name) user.name = name;
    if (department) user.department = department;
    if (status) user.status = String(status).toUpperCase();

    if (req.body.hasOwnProperty("permissions")) {
      user.permissions = req.body.permissions;
    }
    if (req.body.hasOwnProperty("sidebarAccess")) {
      user.sidebarAccess = req.body.sidebarAccess;
    }
    if (req.body.hasOwnProperty("hasCustomPermissions")) {
      user.hasCustomPermissions = req.body.hasCustomPermissions;
    }

    if (password) {
      user.setPassword(password);
    }

    await user.save();

    res.status(200).json({ success: true, message: "User updated successfully", user: user.toSafeJSON() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.role === "SUPER_ADMIN") {
      return res.status(403).json({ success: false, message: "Cannot delete super admin" });
    }

    if (req.user.role !== "SUPER_ADMIN" && getCompanyIdString(user.companyId) !== getCompanyIdString(req.user.companyId)) {
      return res.status(403).json({ success: false, message: "Unauthorized to delete this user" });
    }

    await User.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
