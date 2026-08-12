import User from "../models/User.js";

const getCompanyIdString = (companyId) => {
  if (!companyId) return "";
  if (typeof companyId === "object" && companyId._id) return String(companyId._id);
  return String(companyId);
};

// Helper to restrict role assignment based on current user's role
const getAllowedRoles = (currentUserRole) => {
  if (["SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_ADMIN", "ADMIN"].includes(currentUserRole)) {
    return ["COMPANY_ADMIN", "BRANCH_ADMIN", "ADMIN", "IT_STAFF", "MANAGER", "AUDITOR", "EMPLOYEE"];
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

    const targetCompanyId = (req.user.role !== "SUPER_ADMIN" && req.user.companyId) ? req.user.companyId : (req.body.companyId || null);

    const cleanEmail = String(email || "").trim().toLowerCase();
    const existingUser = await User.findOne({ email: cleanEmail, companyId: targetCompanyId });
    if (existingUser) {
      return res.status(409).json({ success: false, message: "Email is already registered in this company" });
    }

    const trimmedEmpId = String(employeeId || "").trim();
    if (trimmedEmpId) {
      const existingEmployeeId = await User.findOne({ employeeId: trimmedEmpId, companyId: targetCompanyId });
      if (existingEmployeeId) {
        return res.status(409).json({ success: false, message: "Employee ID is already in use in this company" });
      }
    }

    const user = new User({
      name: String(name || "").trim(),
      email: cleanEmail,
      department: String(department || "").trim(),
      role,
      status: String(status || "ACTIVE").toUpperCase(),
      employeeId: trimmedEmpId,
      companyId: targetCompanyId,
    });

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

    const targetCompanyId = user.companyId || null;

    if (email && email.toLowerCase().trim() !== user.email) {
      const cleanEmail = email.toLowerCase().trim();
      const existingUser = await User.findOne({ email: cleanEmail, companyId: targetCompanyId, _id: { $ne: id } });
      if (existingUser) {
        return res.status(409).json({ success: false, message: "Email is already in use in this company" });
      }
      user.email = cleanEmail;
    }

    if (employeeId !== undefined) {
      const trimmedEmpId = String(employeeId || "").trim();
      if (trimmedEmpId && trimmedEmpId !== user.employeeId) {
        const existingEmployeeId = await User.findOne({ employeeId: trimmedEmpId, companyId: targetCompanyId, _id: { $ne: id } });
        if (existingEmployeeId) {
          return res.status(409).json({ success: false, message: "Employee ID is already in use in this company" });
        }
      }
      user.employeeId = trimmedEmpId;
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

export const bulkImportUsers = async (req, res) => {
  try {
    const { users } = req.body;
    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ success: false, message: "Please provide an array of users to import." });
    }

    const targetCompanyId = (req.user.role !== "SUPER_ADMIN" && req.user.companyId) ? req.user.companyId : null;
    const allowedRoles = getAllowedRoles(req.user.role);

    let successCount = 0;
    const errors = [];
    const createdUsers = [];

    for (let i = 0; i < users.length; i++) {
      const item = users[i];
      const rowNum = i + 1;

      const name = String(item.name || item["Full Name"] || item["name"] || "").trim();
      const email = String(item.email || item["Email Address"] || item["Email"] || item["email"] || "").trim().toLowerCase();
      
      const rawRole = String(item.role || item["System Role"] || item["Role"] || item["role"] || "EMPLOYEE").trim();
      let role = rawRole.toUpperCase().replace(/[\s-]+/g, "_");
      if (role === "ADMINISTRATOR" || role === "ADMIN") role = "ADMIN";
      if (role === "COMPANYADMIN" || role === "COMPANY_ADMIN") role = "COMPANY_ADMIN";
      if (role === "BRANCHADMIN" || role === "BRANCH_ADMIN") role = "BRANCH_ADMIN";
      if (role === "ITSTAFF" || role === "IT_STAFF" || role === "IT STAFF") role = "IT_STAFF";

      const password = String(item.password || item["Initial Password"] || item["Password"] || item["password"] || "UserSecure123!").trim();
      const employeeId = String(item.employeeId || item["Employee ID"] || item["Employee ID (Optional)"] || item["employeeId"] || "").trim();
      const department = String(item.department || item["Department"] || item["Department / Cost Center"] || item["department"] || "General").trim();
      const status = String(item.status || item["Status"] || item["status"] || "ACTIVE").toUpperCase();

      if (!name) {
        errors.push(`Row ${rowNum}: Name is required.`);
        continue;
      }
      if (!email || !email.includes("@")) {
        errors.push(`Row ${rowNum} (${name || "User"}): Valid email is required.`);
        continue;
      }
      if (!allowedRoles.includes(role)) {
        role = "EMPLOYEE";
      }

      const existingEmail = await User.findOne({ email, companyId: targetCompanyId });
      if (existingEmail) {
        errors.push(`Row ${rowNum} (${email}): Email is already registered.`);
        continue;
      }

      if (employeeId) {
        const existingEmp = await User.findOne({ employeeId, companyId: targetCompanyId });
        if (existingEmp) {
          errors.push(`Row ${rowNum} (Emp ID ${employeeId}): Employee ID is already in use.`);
          continue;
        }
      }

      const newUser = new User({
        name,
        email,
        department,
        role,
        status: status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
        employeeId,
        companyId: targetCompanyId,
      });

      newUser.setPassword(password);
      await newUser.save();

      createdUsers.push(newUser.toSafeJSON());
      successCount++;
    }

    res.status(200).json({
      success: true,
      message: `Successfully imported ${successCount} user(s).`,
      importedCount: successCount,
      errorsCount: errors.length,
      errors,
      createdUsers,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
