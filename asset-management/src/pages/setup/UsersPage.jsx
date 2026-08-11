import { useState, useEffect } from "react";
import { PageTitle, KpiGrid, DataTable } from "../../components/common/ModuleComponents";
import { FaUserPlus, FaSearch, FaUserShield, FaEnvelope, FaCheckCircle, FaTimesCircle, FaCalendarAlt, FaTrash, FaEdit, FaEye, FaEyeSlash } from "react-icons/fa";
import apiInstance from "../../apis/apiConfig";
import { fetchRoles } from "../../utils/roleApi";
import { usePermissions } from "../../hooks/usePermissions";

export default function UsersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [focusedField, setFocusedField] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { hasPermission, isAdmin } = usePermissions();

  // Mock list of initial users
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [availableRoles, setAvailableRoles] = useState([]);

  // Form State for Adding/Editing New User
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    employeeId: "",
    role: "EMPLOYEE",
    status: "ACTIVE",
    department: ""
  });
  const [formError, setFormError] = useState("");
  const [toastMessage, setToastMessage] = useState("");

  const loadRoles = async () => {
    try {
      const data = await fetchRoles();
      setAvailableRoles(data);
    } catch (error) {
      console.error("Failed to load roles", error);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data } = await apiInstance.get("/users");
      if (data.success) setUsers(data.users);
    } catch (err) {
      setToastMessage(err.response?.data?.message || err.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    loadRoles();
  }, []);


  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.department.trim() || !formData.password) {
      setFormError("Please fill in all required fields.");
      return;
    }

    if (!formData.email.includes("@")) {
      setFormError("Please enter a valid email address.");
      return;
    }

    try {
      if (editingUserId) {
        // Edit mode
        const payload = { ...formData };
        if (!payload.password) delete payload.password; // Don't send empty password if editing
        const { data } = await apiInstance.put(`/users/${editingUserId}`, payload);
        if (data.success) {
          setUsers(users.map(u => u.id === editingUserId ? data.user : u));
          setShowAddModal(false);
          setEditingUserId(null);
          setFormData({ name: "", email: "", password: "", employeeId: "", role: "EMPLOYEE", status: "ACTIVE", department: "" });
          setFormError("");
          setToastMessage(`User ${data.user.name} updated successfully!`);
          setTimeout(() => setToastMessage(""), 3000);
        } else {
          setFormError(data.message || "Error updating user");
        }
      } else {
        // Create mode
        const { data } = await apiInstance.post("/users", formData);
        if (data.success) {
          setUsers([data.user, ...users]);
          setShowAddModal(false);
          setFormData({ name: "", email: "", password: "", employeeId: "", role: "EMPLOYEE", status: "ACTIVE", department: "" });
          setFormError("");
          setToastMessage(`User ${data.user.name} created successfully!`);
          setTimeout(() => setToastMessage(""), 3000);
        } else {
          setFormError(data.message || "Error creating user");
        }
      }
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || "Failed to process user");
    }
  };

  const handleEditUser = (user) => {
    setEditingUserId(user.id);
    setFormData({
      name: user.name,
      email: user.email,
      password: "", // Empty so they don't have to change it
      employeeId: user.employeeId || "",
      role: user.role,
      status: user.status,
      department: user.department || ""
    });
    setShowAddModal(true);
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      const { data } = await apiInstance.delete(`/users/${id}`);
      if (data.success) {
        setUsers(users.filter(u => u.id !== id));
        setToastMessage("User deleted successfully!");
        setTimeout(() => setToastMessage(""), 3000);
      } else {
        alert(data.message || "Failed to delete user");
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Error deleting user");
    }
  };

  const toggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      const { data } = await apiInstance.put(`/users/${id}`, { status: newStatus });
      if (data.success) {
        setUsers(users.map(u => u.id === id ? { ...u, status: newStatus } : u));
      }
    } catch (err) {
      console.error("Failed to toggle status", err);
    }
  };

  // KPI items
  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.status === "ACTIVE" || u.status === "Active").length;
  const admins = users.filter((u) => u.role === "ADMIN" || u.role === "COMPANY_ADMIN" || u.role === "BRANCH_ADMIN" || u.role === "SUPER_ADMIN").length;
  const staff = users.filter((u) => u.role === "IT_STAFF").length;

  const kpis = [
    { label: "Total Users", value: totalUsers },
    { label: "Active Users", value: activeUsers },
    { label: "Administrators", value: admins },
    { label: "IT Staff", value: staff },
  ];

  // Filtering Logic
  const filteredUsers = users.filter((u) => {
    const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          u.department.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "ALL" ? true : u.role === roleFilter;
    const matchesStatus = statusFilter === "ALL" ? true : (u.status === statusFilter || u.status?.toUpperCase() === statusFilter?.toUpperCase());
    return matchesSearch && matchesRole && matchesStatus;
  });

  const getInitials = (name) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getRoleLabel = (role) => {
    if (role === "SUPER_ADMIN") return "Super Admin";
    if (role === "COMPANY_ADMIN") return "Company Admin";
    if (role === "BRANCH_ADMIN") return "Branch Admin";
    if (role === "ADMIN") return "Admin";
    if (role === "IT_STAFF") return "IT Staff";
    if (role === "MANAGER") return "Manager";
    if (role === "AUDITOR") return "Auditor";
    if (role === "EMPLOYEE") return "Employee";
    return role ? String(role).replace(/_/g, " ") : "Employee";
  };


  const columns = [
    {
      key: "name",
      label: "User Details",
      render: (row) => (
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {row.profilePhoto ? (
            <img
              src={row.profilePhoto}
              alt={row.name}
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                objectFit: "cover"
              }}
            />
          ) : (
            <div style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #0d9488, #0f766e)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "700",
              fontSize: "13px"
            }}>
              {getInitials(row.name)}
            </div>
          )}
          <div>
            <div style={{ fontWeight: "600", color: "var(--text-main)" }}>{row.name}</div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
              <FaEnvelope style={{ fontSize: "10px" }} /> {row.email}
            </div>
          </div>
        </div>
      )
    },
    {
      key: "department",
      label: "Department",
      render: (row) => <span style={{ color: "#475569" }}>{row.department}</span>
    },
    {
      key: "role",
      label: "System Role",
      render: (row) => {
        const isAdminRole = ["ADMIN", "COMPANY_ADMIN", "BRANCH_ADMIN", "SUPER_ADMIN"].includes(row.role);
        return (
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "4px 8px",
            borderRadius: "12px",
            fontSize: "12px",
            fontWeight: "600",
            backgroundColor: isAdminRole ? "#FEF3C7" : row.role === "IT_STAFF" ? "#E0F2FE" : "#F1F5F9",
            color: isAdminRole ? "#92400E" : row.role === "IT_STAFF" ? "#0369A1" : "#475569"
          }}>
            <FaUserShield style={{ fontSize: "11px" }} /> {getRoleLabel(row.role)}
          </span>
        );
      }
    },
    {
      key: "status",
      label: "Status",
      render: (row) => (
        <span style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          padding: "4px 8px",
          borderRadius: "4px",
          fontSize: "12px",
          fontWeight: "600",
          backgroundColor: (row.status === "ACTIVE" || row.status === "Active") ? "#ECFDF5" : "#FEF2F2",
          color: (row.status === "ACTIVE" || row.status === "Active") ? "#047857" : "#B91C1C"
        }}>
          {(row.status === "ACTIVE" || row.status === "Active") ? <FaCheckCircle /> : <FaTimesCircle />} {row.status}
        </span>
      )
    },
    {
      key: "lastActive",
      label: "Last Active",
      render: (row) => (
        <span style={{ color: "var(--text-muted)", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
          <FaCalendarAlt style={{ fontSize: "11px" }} /> {row.lastActive || "-"}
        </span>
      )
    },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-start" }}>
          {(hasPermission("user.edit") || isAdmin) && (
            <button
              onClick={() => toggleStatus(row.id, row.status)}
              className="secondary-button"
              style={{ height: "26px", fontSize: "11px", minWidth: "70px" }}
            >
              {row.status === "ACTIVE" || row.status === "Active" ? "Deactivate" : "Activate"}
            </button>
          )}
          {(hasPermission("user.edit") || isAdmin) && (
            <button 
              onClick={() => handleEditUser(row)}
              style={{
                background: "none",
                border: "none",
                color: "var(--color-primary)",
                cursor: "pointer",
                padding: "4px"
              }}
              title="Edit User"
            >
              <FaEdit />
            </button>
          )}
          {(hasPermission("user.delete") || isAdmin) && (
            <button 
              onClick={() => handleDeleteUser(row.id)}
              style={{
                background: "none",
                border: "none",
                color: "#ef4444",
                cursor: "pointer",
                padding: "4px"
              }}
              title="Delete User"
            >
              <FaTrash />
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", paddingBottom: "32px" }}>
      <PageTitle 
        action={
          (hasPermission("user.create") || isAdmin) ? (
            <button 
              className="module-button"
              onClick={() => setShowAddModal(true)}
              style={{ display: "flex", alignItems: "center", gap: "8px" }}
            >
              <FaUserPlus /> Add User
            </button>
          ) : null
        } 
      />

      {toastMessage && (
        <div style={{
          backgroundColor: "#ECFDF5",
          border: "1px solid #10B981",
          color: "#047857",
          padding: "12px 16px",
          borderRadius: "8px",
          fontWeight: "600",
          fontSize: "14px",
          animation: "fadeIn 0.3s ease",
          boxShadow: "var(--shadow-sm)"
        }}>
          {toastMessage}
        </div>
      )}

      <KpiGrid items={kpis} />

      {/* Modern Filter Interface */}
      <div className="action-panel" style={{
        display: "grid",
        gridTemplateColumns: "1fr auto auto",
        gap: "12px",
        padding: "16px",
        borderRadius: "var(--radius-lg)"
      }}>
        <h3 style={{ gridColumn: "1 / -1", margin: 0, fontSize: "14px", color: "var(--text-muted)" }}>Search & Filters</h3>
        <div style={{ position: "relative" }}>
          <input
            type="text"
            placeholder="Search by name, email or department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: "100%", paddingLeft: "36px" }}
          />
          <FaSearch style={{
            position: "absolute",
            left: "12px",
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--text-muted)"
          }} />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="ALL">All Roles</option>
          <option value="COMPANY_ADMIN">Company Admin</option>
          <option value="ADMIN">Admin</option>
          <option value="IT_STAFF">IT Staff</option>
          <option value="MANAGER">Manager</option>
          <option value="AUDITOR">Auditor</option>
          <option value="EMPLOYEE">Employee</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="ALL">All Status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      {/* Data Table */}
      <DataTable columns={columns} rows={filteredUsers} emptyText="No users match the search filters." />

      {/* Add User Modal */}
      {showAddModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(15, 23, 42, 0.3)",
          backdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          animation: "fadeIn 0.2s ease"
        }}>
          <div style={{
            background: "var(--bg-surface)",
            borderRadius: "14px",
            width: "500px",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 1px rgba(0, 0, 0, 0.15)",
            border: "1px solid var(--border-color)",
            overflow: "hidden",
            transition: "all 0.3s ease"
          }}>
            {/* Modal Header */}
            <div style={{
              padding: "18px 24px",
              borderBottom: "1px solid var(--border-color)",
              background: "linear-gradient(135deg, #eff6ff, #f8fafc)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "var(--text-main)", letterSpacing: "-0.01em" }}>
                {editingUserId ? "Edit User" : "Add New System User"}
              </h3>
              <button 
                onClick={() => {
                  setShowAddModal(false);
                  setEditingUserId(null);
                  setFormData({ name: "", email: "", password: "", employeeId: "", role: "EMPLOYEE", status: "ACTIVE", department: "" });
                  setShowPassword(false);
                }}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "20px",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  width: "30px",
                  height: "30px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s ease"
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(100, 116, 139, 0.1)";
                  e.currentTarget.style.color = "var(--text-main)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "var(--text-muted)";
                }}
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleAddUser} style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
              {formError && (
                <div style={{
                  color: "#ef4444",
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fecaca",
                  padding: "12px 14px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "600",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}>
                  <span>⚠</span> {formError}
                </div>
              )}

              {/* Full Name Field */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Full Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g. John Doe"
                  required
                  onFocus={() => setFocusedField("name")}
                  onBlur={() => setFocusedField("")}
                  style={{
                    width: "100%",
                    height: "40px",
                    padding: "0 14px",
                    fontSize: "13px",
                    borderRadius: "8px",
                    border: focusedField === "name" ? "1px solid var(--color-primary)" : "1px solid var(--border-color)",
                    boxShadow: focusedField === "name" ? "0 0 0 3px rgba(33, 133, 243, 0.15)" : "var(--shadow-sm)",
                    backgroundColor: "var(--bg-surface)",
                    color: "var(--text-main)",
                    transition: "all 0.2s ease",
                    outline: "none",
                    boxSizing: "border-box"
                  }}
                />
              </div>

              {/* Email Address Field */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="e.g. john.doe@assetpro.com"
                  required
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField("")}
                  style={{
                    width: "100%",
                    height: "40px",
                    padding: "0 14px",
                    fontSize: "13px",
                    borderRadius: "8px",
                    border: focusedField === "email" ? "1px solid var(--color-primary)" : "1px solid var(--border-color)",
                    boxShadow: focusedField === "email" ? "0 0 0 3px rgba(33, 133, 243, 0.15)" : "var(--shadow-sm)",
                    backgroundColor: "var(--bg-surface)",
                    color: "var(--text-main)",
                    transition: "all 0.2s ease",
                    outline: "none",
                    boxSizing: "border-box"
                  }}
                />
              </div>

              {/* Password Field */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {editingUserId ? "Change Password (Optional)" : "Initial Password"}
                </label>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder={editingUserId ? "Leave blank to keep unchanged" : "e.g. UserSecure123!"}
                    required={!editingUserId}
                    onFocus={() => setFocusedField("password")}
                    onBlur={() => setFocusedField("")}
                    style={{
                      width: "100%",
                      height: "40px",
                      padding: "0 40px 0 14px",
                      fontSize: "13px",
                      borderRadius: "8px",
                      border: focusedField === "password" ? "1px solid var(--color-primary)" : "1px solid var(--border-color)",
                      boxShadow: focusedField === "password" ? "0 0 0 3px rgba(33, 133, 243, 0.15)" : "var(--shadow-sm)",
                      backgroundColor: "var(--bg-surface)",
                      color: "var(--text-main)",
                      transition: "all 0.2s ease",
                      outline: "none",
                      boxSizing: "border-box"
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: "absolute",
                      right: "12px",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--text-muted)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "4px"
                    }}
                    title={showPassword ? "Hide Password" : "Show Password"}
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              {/* Employee ID Field */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Employee ID (Optional)
                </label>
                <input
                  type="text"
                  name="employeeId"
                  value={formData.employeeId}
                  onChange={handleInputChange}
                  placeholder="e.g. EMP-001"
                  onFocus={() => setFocusedField("employeeId")}
                  onBlur={() => setFocusedField("")}
                  style={{
                    width: "100%",
                    height: "40px",
                    padding: "0 14px",
                    fontSize: "13px",
                    borderRadius: "8px",
                    border: focusedField === "employeeId" ? "1px solid var(--color-primary)" : "1px solid var(--border-color)",
                    boxShadow: focusedField === "employeeId" ? "0 0 0 3px rgba(33, 133, 243, 0.15)" : "var(--shadow-sm)",
                    backgroundColor: "var(--bg-surface)",
                    color: "var(--text-main)",
                    transition: "all 0.2s ease",
                    outline: "none",
                    boxSizing: "border-box"
                  }}
                />
              </div>

              {/* Department / Cost Center Field */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Department / Cost Center
                </label>
                <input
                  type="text"
                  name="department"
                  value={formData.department}
                  onChange={handleInputChange}
                  placeholder="e.g. Finance, Tech Operations"
                  required
                  onFocus={() => setFocusedField("department")}
                  onBlur={() => setFocusedField("")}
                  style={{
                    width: "100%",
                    height: "40px",
                    padding: "0 14px",
                    fontSize: "13px",
                    borderRadius: "8px",
                    border: focusedField === "department" ? "1px solid var(--color-primary)" : "1px solid var(--border-color)",
                    boxShadow: focusedField === "department" ? "0 0 0 3px rgba(33, 133, 243, 0.15)" : "var(--shadow-sm)",
                    backgroundColor: "var(--bg-surface)",
                    color: "var(--text-main)",
                    transition: "all 0.2s ease",
                    outline: "none",
                    boxSizing: "border-box"
                  }}
                />
              </div>

              {/* System Role & Status Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    System Role
                  </label>
                  <select 
                    name="role" 
                    value={formData.role} 
                    onChange={handleInputChange}
                    onFocus={() => setFocusedField("role")}
                    onBlur={() => setFocusedField("")}
                    style={{
                      width: "100%",
                      height: "40px",
                      padding: "0 14px",
                      fontSize: "13px",
                      borderRadius: "8px",
                      border: focusedField === "role" ? "1px solid var(--color-primary)" : "1px solid var(--border-color)",
                      boxShadow: focusedField === "role" ? "0 0 0 3px rgba(33, 133, 243, 0.15)" : "var(--shadow-sm)",
                      backgroundColor: "var(--bg-surface)",
                      color: "var(--text-main)",
                      transition: "all 0.2s ease",
                      outline: "none",
                      cursor: "pointer",
                      boxSizing: "border-box"
                    }}
                  >
                    {availableRoles.map((role) => (
                      <option key={role.key} value={role.key}>
                        {role.label}
                      </option>
                    ))}
                    {availableRoles.length === 0 && (
                      <>
                        <option value="AUDITOR">Auditor</option>
                        <option value="MANAGER">Manager</option>
                        <option value="IT_STAFF">IT Staff</option>
                        <option value="EMPLOYEE">Employee</option>
                      </>
                    )}
                  </select>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Status
                  </label>
                  <select 
                    name="status" 
                    value={formData.status} 
                    onChange={handleInputChange}
                    onFocus={() => setFocusedField("status")}
                    onBlur={() => setFocusedField("")}
                    style={{
                      width: "100%",
                      height: "40px",
                      padding: "0 14px",
                      fontSize: "13px",
                      borderRadius: "8px",
                      border: focusedField === "status" ? "1px solid var(--color-primary)" : "1px solid var(--border-color)",
                      boxShadow: focusedField === "status" ? "0 0 0 3px rgba(33, 133, 243, 0.15)" : "var(--shadow-sm)",
                      backgroundColor: "var(--bg-surface)",
                      color: "var(--text-main)",
                      transition: "all 0.2s ease",
                      outline: "none",
                      cursor: "pointer",
                      boxSizing: "border-box"
                    }}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ 
                display: "flex", 
                justifyContent: "flex-end", 
                gap: "12px", 
                marginTop: "12px",
                paddingTop: "16px",
                borderTop: "1px solid var(--border-color)"
              }}>
                <button 
                  type="button" 
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingUserId(null);
                    setFormData({ name: "", email: "", password: "", employeeId: "", role: "EMPLOYEE", status: "ACTIVE", department: "" });
                    setShowPassword(false);
                  }}
                  style={{
                    height: "40px",
                    padding: "0 20px",
                    fontSize: "13px",
                    fontWeight: "600",
                    borderRadius: "8px",
                    border: "1px solid var(--border-color)",
                    backgroundColor: "#ffffff",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--bg-subtle)";
                    e.currentTarget.style.color = "var(--text-main)";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = "#ffffff";
                    e.currentTarget.style.color = "var(--text-muted)";
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  style={{
                    height: "40px",
                    padding: "0 20px",
                    fontSize: "13px",
                    fontWeight: "600",
                    borderRadius: "8px",
                    border: "none",
                    background: "linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))",
                    color: "#ffffff",
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(33, 133, 243, 0.2)",
                    transition: "all 0.2s ease",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = "translateY(-1px)";
                    e.currentTarget.style.boxShadow = "0 6px 16px rgba(33, 133, 243, 0.3)";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = "none";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(33, 133, 243, 0.2)";
                  }}
                >
                  {editingUserId ? "Save Changes" : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
