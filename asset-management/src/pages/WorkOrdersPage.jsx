import React, { useEffect, useState } from "react";
import apiInstance from "../apis/apiConfig";
import { useToast } from "../components/toast/toastStore";
import { 
  FaWrench, 
  FaSearch, 
  FaTimes, 
  FaPlus, 
  FaTrash, 
  FaClipboardList, 
  FaTools, 
  FaCheckCircle, 
  FaExclamationTriangle, 
  FaSpinner, 
  FaSlidersH,
  FaArrowRight
} from "react-icons/fa";
import { useSelector } from "react-redux";
import "./WorkOrdersPage.css";
import { pushAppNotification } from "../utils/notificationStore";
import { loadAssetFormConfig } from "../utils/assetFormBuilder";



const emptyWorkOrderForm = {
  assetId: "",
  assetName: "",
  complaintType: "Maintenance",
  complaintTitle: "",
  priority: "Medium",
  raisedBy: "",
  raisedByEmail: "",
  employeeEmail: "",
};

function WorkOrdersPage() {
  const { showToast } = useToast();
  const user = useSelector((state) => state.auth?.user);
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // RBAC Check
  const canManageWorkOrders = ["SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_ADMIN", "ADMIN", "IT_STAFF"].includes(String(user?.role || "").toUpperCase());

  // Filters & State
  const [activeKpi, setActiveKpi] = useState("All"); // All, Open, Ongoing, Completed
  const [activeTab, setActiveTab] = useState("All"); // All, Open Complaints, In Progress WO, Completed WO
  const [searchQuery, setSearchQuery] = useState("");
  const [productFilter, setProductFilter] = useState("");
  
  // Drawer state
  const [selectedWO, setSelectedWO] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(emptyWorkOrderForm);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Editable Drawer Form fields
  const [priority, setPriority] = useState("Medium");
  const [assignedTo, setAssignedTo] = useState("");
  const [workOrderSelection, setWorkOrderSelection] = useState("");
  const [workOrderCost, setWorkOrderCost] = useState(0);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [status, setStatus] = useState("Open");
  const [tasks, setTasks] = useState([]);
  const [checklists, setChecklists] = useState([]);

  const [categoryOptions, setCategoryOptions] = useState([]);

  // Fetch asset categories catalog to populate work order categories dynamically
  useEffect(() => {
    try {
      const config = loadAssetFormConfig();
      const categories = config?.__categoryCatalog?.categories || [];
      const names = categories.map((cat) => cat.name).filter(Boolean);
      setCategoryOptions(names);
    } catch (err) {
      console.error("Failed to load asset categories configuration", err);
    }
  }, []);

  // Load All Work Orders
  const fetchWorkOrders = async () => {
    try {
      setLoading(true);
      const response = await apiInstance.get("/work-orders");
      if (response.data.success) {
        setWorkOrders(response.data.workOrders || []);
      } else {
        showToast({
          title: "Data Error",
          message: response.data.message || "Failed to load work orders.",
          type: "error",
        });
      }
    } catch (error) {
      showToast({
        title: "Connection Error",
        message: error.response?.data?.message || "Failed to connect to backend server.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canManageWorkOrders) {
      fetchWorkOrders();
    }
  }, [canManageWorkOrders]);

  // Sync Drawer editable state when selectedWO changes
  useEffect(() => {
    if (selectedWO) {
      setPriority(selectedWO.priority || "Medium");
      setAssignedTo(selectedWO.assignedTo || "");
      setWorkOrderSelection(selectedWO.workOrderSelection || "");
      setWorkOrderCost(selectedWO.workOrderCost || 0);
      setInvoiceNumber(selectedWO.invoiceNumber || "");
      setStatus(selectedWO.status || "Open");
      setTasks(selectedWO.tasks ? [...selectedWO.tasks] : []);
      setChecklists(selectedWO.checklists ? [...selectedWO.checklists] : []);
    }
  }, [selectedWO]);

  // Compute metrics from full workOrders array
  const openCount = workOrders.filter(wo => wo.status === "Open").length;
  const ongoingCount = workOrders.filter(wo => wo.status === "In Progress").length;
  const completedCount = workOrders.filter(wo => wo.status === "Completed").length;
  const totalCount = workOrders.length;

  // Filter products/assets list dynamically
  const uniqueProducts = Array.from(new Set(workOrders.map(wo => wo.assetName))).filter(Boolean).sort();

  // Filter complaints based on Search, KPI, Tabs, and Product dropdown
  const filteredWorkOrders = workOrders.filter(wo => {
    // 1. KPI Filter
    if (activeKpi === "Open" && wo.status !== "Open") return false;
    if (activeKpi === "Ongoing" && wo.status !== "In Progress") return false;
    if (activeKpi === "Completed" && wo.status !== "Completed") return false;

    // 2. Tab Filter
    if (activeTab === "Open Complaints" && wo.status !== "Open") return false;
    if (activeTab === "In Progress WO" && wo.status !== "In Progress") return false;
    if (activeTab === "Completed WO" && wo.status !== "Completed") return false;

    // 3. Search Query Filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchId = wo.complaintId?.toLowerCase().includes(q);
      const matchAssetId = wo.assetId?.toLowerCase().includes(q);
      const matchAssetName = wo.assetName?.toLowerCase().includes(q);
      const matchType = wo.complaintType?.toLowerCase().includes(q);
      const matchTitle = wo.complaintTitle?.toLowerCase().includes(q);
      if (!matchId && !matchAssetId && !matchAssetName && !matchType && !matchTitle) return false;
    }

    // 4. Product Dropdown Filter
    if (productFilter && wo.assetName !== productFilter) return false;

    return true;
  });

  // Task Grid Managers Actions
  const handleAddTask = () => {
    setTasks([...tasks, { taskName: "", description: "" }]);
  };

  const handleUpdateTaskField = (index, field, value) => {
    const updated = [...tasks];
    updated[index][field] = value;
    setTasks(updated);
  };

  const handleDeleteTask = (index) => {
    const updated = [...tasks];
    updated.splice(index, 1);
    setTasks(updated);
  };

  // Checklist Grid Manager Actions
  const handleAddChecklist = () => {
    setChecklists([...checklists, { checkName: "", description: "" }]);
  };

  const handleUpdateChecklistField = (index, field, value) => {
    const updated = [...checklists];
    updated[index][field] = value;
    setChecklists(updated);
  };

  const handleDeleteChecklist = (index) => {
    const updated = [...checklists];
    updated.splice(index, 1);
    setChecklists(updated);
  };

  const handleCreateField = (field, value) => {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateWorkOrder = async (e) => {
    e.preventDefault();
    if (!createForm.assetName.trim() || !createForm.complaintTitle.trim()) {
      showToast({
        title: "Required Details Missing",
        message: "Asset name and complaint title are required.",
        type: "error",
      });
      return;
    }

    try {
      setDrawerLoading(true);
      const response = await apiInstance.post("/work-orders", {
        ...createForm,
        raisedBy: createForm.raisedBy || user?.name || "Asset User",
        raisedByEmail: createForm.raisedByEmail || user?.email || "",
        employeeEmail: createForm.employeeEmail || createForm.raisedByEmail || user?.email || "",
      });

      if (response.data.success) {
        showToast({
          title: "Work Order Created",
          message: "Open it with Review, add cost/invoice, then mark Completed.",
          type: "success",
        });
        setCreateForm(emptyWorkOrderForm);
        setIsCreateOpen(false);
        fetchWorkOrders();
      }
    } catch (error) {
      showToast({
        title: "Create Failed",
        message: error.response?.data?.message || "Unable to create work order.",
        type: "error",
      });
    } finally {
      setDrawerLoading(false);
    }
  };

  // Submit/Update changes to backend
  const handleUpdateWorkOrder = async (e) => {
    e.preventDefault();
    if (!selectedWO) return;

    // Basic validation
    const emptyTasks = tasks.some(t => !t.taskName.trim());
    const emptyChecklists = checklists.some(c => !c.checkName.trim());

    if (emptyTasks) {
      showToast({
        title: "Validation Error",
        message: "Please fill out all task names or remove empty rows.",
        type: "error",
      });
      return;
    }

    if (emptyChecklists) {
      showToast({
        title: "Validation Error",
        message: "Please fill out all checklist names or remove empty rows.",
        type: "error",
      });
      return;
    }

    if (status === "Completed" && !(Number(workOrderCost) > 0)) {
      showToast({
        title: "Cost Required",
        message: "Enter maintenance cost before completing the work order.",
        type: "error",
      });
      return;
    }

    if (status === "Completed" && !String(invoiceNumber || "").trim()) {
      showToast({
        title: "Invoice Required",
        message: "Enter invoice number before completing the work order.",
        type: "error",
      });
      return;
    }

    try {
      setDrawerLoading(true);
      const payload = {
        priority,
        assignedTo,
        workOrderSelection,
        workOrderCost: Number(workOrderCost) || 0,
        invoiceNumber,
        status,
        tasks,
        checklists
      };

      const response = await apiInstance.put(`/work-orders/${selectedWO._id}`, payload);
      
      if (response.data.success) {
        // Notify the employee of the status update
        pushAppNotification({
          title: `Work Order: ${status}`,
          message: `Your complaint ${selectedWO.complaintId} on asset ${selectedWO.assetName} is now ${status}.`,
          type: status === "Completed" ? "success" : "info",
          meta: {
            menuLabel: "My Assets",
            route: "/my-assets",
            targetUsers: [selectedWO.employeeEmail, selectedWO.raisedByEmail, selectedWO.raisedBy].filter(Boolean)
          }
        });

        showToast({
          title: "Work Order Updated",
          message: response.data.reimbursementPost
            ? "Completed and reimbursement pushed to Expense."
            : response.data.message || `Successfully reviewed ${selectedWO.complaintId}.`,
          type: "success",
        });
        
        // Refresh items list
        fetchWorkOrders();
        setIsDrawerOpen(false);
        setSelectedWO(null);
      } else {
        showToast({
          title: "Update Error",
          message: response.data.message || "Failed to update work order details.",
          type: "error",
        });
      }
    } catch (error) {
      showToast({
        title: "Connection Error",
        message: error.response?.data?.message || "Failed to connect to the server.",
        type: "error",
      });
    } finally {
      setDrawerLoading(false);
    }
  };

  const getPriorityBadgeClass = (level) => {
    switch (level) {
      case "High":
        return "priority-badge high";
      case "Medium":
        return "priority-badge medium";
      case "Low":
        return "priority-badge low";
      default:
        return "priority-badge default";
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "Open":
        return "status-badge open";
      case "In Progress":
        return "status-badge ongoing";
      case "Completed":
        return "status-badge completed";
      default:
        return "status-badge default";
    }
  };

  if (!canManageWorkOrders) {
    return (
      <div className="app-container work-orders-page">
        <div className="procurement-empty-state" style={{ marginTop: '100px' }}>
          <FaWrench style={{ fontSize: '48px', color: '#94a3b8', marginBottom: '16px' }} />
          <h3>Access Restricted</h3>
          <p>Work Orders are generated automatically when employees submit Complaints in the Requests module.</p>
          <p style={{ marginTop: '8px' }}>Only Administrators and IT/Maintenance users have permission to review, assign, and update Work Orders.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container work-orders-page">
      {/* Metric Cards Panel */}
      <div className="metrics-panel">
        <div 
          className={`metric-card ${activeKpi === "Open" ? "active" : ""}`}
          onClick={() => {
            setActiveKpi(activeKpi === "Open" ? "All" : "Open");
            setActiveTab("All");
          }}
        >
          <div className="metric-icon open-icon">
            <FaExclamationTriangle />
          </div>
          <div className="metric-details">
            <h3 className="metric-number">{openCount}</h3>
            <p className="metric-label">Open Complaints</p>
          </div>
        </div>

        <div 
          className={`metric-card ${activeKpi === "Ongoing" ? "active" : ""}`}
          onClick={() => {
            setActiveKpi(activeKpi === "Ongoing" ? "All" : "Ongoing");
            setActiveTab("All");
          }}
        >
          <div className="metric-icon ongoing-icon">
            <FaTools />
          </div>
          <div className="metric-details">
            <h3 className="metric-number">{ongoingCount}</h3>
            <p className="metric-label">Ongoing WO</p>
          </div>
        </div>

        <div 
          className={`metric-card ${activeKpi === "Completed" ? "active" : ""}`}
          onClick={() => {
            setActiveKpi(activeKpi === "Completed" ? "All" : "Completed");
            setActiveTab("All");
          }}
        >
          <div className="metric-icon completed-icon">
            <FaCheckCircle />
          </div>
          <div className="metric-details">
            <h3 className="metric-number">{completedCount}</h3>
            <p className="metric-label">Completed WO</p>
          </div>
        </div>

        <div 
          className={`metric-card ${activeKpi === "All" ? "active" : ""}`}
          onClick={() => {
            setActiveKpi("All");
            setActiveTab("All");
          }}
        >
          <div className="metric-icon all-icon">
            <FaClipboardList />
          </div>
          <div className="metric-details">
            <h3 className="metric-number">{totalCount}</h3>
            <p className="metric-label">All Requests</p>
          </div>
        </div>
      </div>

      {/* Tab Controls Menu */}
      <div className="tab-navigation-bar">
        <div className="tabs-header">
          {["All", "Open Complaints", "In Progress WO", "Completed WO"].map((tab) => (
            <button
              key={tab}
              type="button"
              className={`tab-btn ${activeTab === tab ? "active" : ""}`}
              onClick={() => {
                setActiveTab(tab);
                setActiveKpi("All"); // Reset KPI filter to prevent clash
              }}
            >
              {tab === "All" ? "All Requests" : tab}
            </button>
          ))}
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="filters-action-row">
        <div className="search-box">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search by Complaint ID, Asset ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button 
              type="button" 
              className="clear-search-btn"
              onClick={() => setSearchQuery("")}
            >
              <FaTimes />
            </button>
          )}
        </div>

        <div className="filter-dropdown-container">
          <FaSlidersH className="slider-icon" />
          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="product-filter-select"
          >
            <option value="">All Products/Assets</option>
            {uniqueProducts.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="create-work-order-btn"
          onClick={() => setIsCreateOpen(true)}
        >
          <FaPlus /> Create Work Order
        </button>
      </div>

      {/* Complaints Listing Table */}
      <div className="complaints-table-container">
        {loading ? (
          <div className="table-state-loading">
            <FaSpinner className="spin" />
            <p>Loading Work Orders...</p>
          </div>
        ) : filteredWorkOrders.length === 0 ? (
          <div className="table-state-empty">
            <FaWrench />
            <h3>No Work Orders Found</h3>
            <p>Try refining your search queries or filter dropdown selectors.</p>
          </div>
        ) : (
          <table className="complaints-table">
            <thead>
              <tr>
                <th>Complaint ID</th>
                <th>Date</th>
                <th>Asset Details</th>
                <th>Complainant</th>
                <th>Complaint Title</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredWorkOrders.map((wo) => (
                <tr key={wo._id}>
                  <td className="complaint-id-col">
                    <span className="id-badge">{wo.complaintId}</span>
                  </td>
                  <td className="date-col">
                    {new Date(wo.complaintDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="asset-details-col">
                    <span className="asset-name">{wo.assetName}</span>
                    <span className="asset-id">{wo.assetId}</span>
                  </td>
                  <td className="raised-by-col">
                    <span className="user-name">{wo.raisedBy}</span>
                  </td>
                  <td className="title-col">
                    <div className="complaint-type-tag">{wo.complaintType}</div>
                    <span className="complaint-text" title={wo.complaintTitle}>
                      {wo.complaintTitle || "No Title"}
                    </span>
                  </td>
                  <td className="priority-col">
                    <span className={getPriorityBadgeClass(wo.priority)}>
                      {wo.priority}
                    </span>
                  </td>
                  <td className="status-col">
                    <span className={getStatusBadgeClass(wo.status)}>
                      {wo.status}
                    </span>
                  </td>
                  <td className="action-col">
                    <button
                      type="button"
                      className="review-action-btn"
                      onClick={() => {
                        setSelectedWO(wo);
                        setIsDrawerOpen(true);
                      }}
                    >
                      Review <FaArrowRight className="btn-arrow" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Review Complaint Drawer Overlay */}
      {isCreateOpen && (
        <div className="drawer-overlay" onClick={() => setIsCreateOpen(false)}>
          <div className="review-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div className="header-title-block">
                <span className="drawer-badge">New</span>
                <h2>Create Work Order</h2>
              </div>
              <button
                type="button"
                className="close-drawer-btn"
                onClick={() => setIsCreateOpen(false)}
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleCreateWorkOrder} className="drawer-form">
              <div className="drawer-body">
                <div className="form-fields-grid">
                  <div className="form-group">
                    <label>Asset ID</label>
                    <input value={createForm.assetId} onChange={(e) => handleCreateField("assetId", e.target.value)} placeholder="e.g. DEMO-WAR-001" />
                  </div>
                  <div className="form-group">
                    <label>Asset Name</label>
                    <input value={createForm.assetName} onChange={(e) => handleCreateField("assetName", e.target.value)} placeholder="e.g. Demo Dell Latitude" required />
                  </div>
                  <div className="form-group">
                    <label>Complaint Type</label>
                    <input value={createForm.complaintType} onChange={(e) => handleCreateField("complaintType", e.target.value)} placeholder="Maintenance" />
                  </div>
                  <div className="form-group">
                    <label>Priority</label>
                    <select value={createForm.priority} onChange={(e) => handleCreateField("priority", e.target.value)}>
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Raised By</label>
                    <input value={createForm.raisedBy} onChange={(e) => handleCreateField("raisedBy", e.target.value)} placeholder={user?.name || "Employee name"} />
                  </div>
                  <div className="form-group">
                    <label>Employee Email</label>
                    <input type="email" value={createForm.employeeEmail} onChange={(e) => handleCreateField("employeeEmail", e.target.value)} placeholder={user?.email || "employee@company.com"} />
                  </div>
                </div>

                <div className="complaint-summary-block">
                  <label>Complaint Title/Description</label>
                  <textarea
                    value={createForm.complaintTitle}
                    onChange={(e) => handleCreateField("complaintTitle", e.target.value)}
                    placeholder="Describe the maintenance or repair issue"
                    required
                  />
                </div>
              </div>

              <div className="drawer-footer">
                <button type="button" className="drawer-cancel-btn" onClick={() => setIsCreateOpen(false)} disabled={drawerLoading}>Cancel</button>
                <button type="submit" className="drawer-submit-btn" disabled={drawerLoading}>
                  {drawerLoading ? <><FaSpinner className="spin" /> Creating...</> : "Create Work Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDrawerOpen && selectedWO && (
        <div className="drawer-overlay" onClick={() => setIsDrawerOpen(false)}>
          <div className="review-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div className="header-title-block">
                <span className="drawer-badge">{selectedWO.complaintId}</span>
                <h2>Review Complaint</h2>
              </div>
              <button 
                type="button" 
                className="close-drawer-btn"
                onClick={() => setIsDrawerOpen(false)}
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleUpdateWorkOrder} className="drawer-form">
              <div className="drawer-body">
                {/* Meta details cards */}
                <div className="meta-info-grid">
                  <div className="meta-card-item">
                    <label>Complainant</label>
                    <p>{selectedWO.raisedBy}</p>
                  </div>
                  <div className="meta-card-item">
                    <label>Asset Name</label>
                    <p>{selectedWO.assetName}</p>
                  </div>
                  <div className="meta-card-item">
                    <label>Asset ID</label>
                    <p>{selectedWO.assetId}</p>
                  </div>
                  <div className="meta-card-item">
                    <label>Complaint Type</label>
                    <p>{selectedWO.complaintType}</p>
                  </div>
                </div>

                <div className="complaint-summary-block">
                  <label>Complaint Title/Desc</label>
                  <p>{selectedWO.complaintTitle || "No detailed description provided."}</p>
                  
                  {selectedWO.incidentImage && (
                    <div style={{ marginTop: "16px" }}>
                      <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "0.85rem", color: "#6b7280" }}>Damage Image</label>
                      <img src={selectedWO.incidentImage} alt="Incident" style={{ maxWidth: "100%", maxHeight: "300px", borderRadius: "8px", border: "1px solid #e5e7eb" }} />
                    </div>
                  )}
                </div>

                <hr className="drawer-divider" />

                {/* Form Selects */}
                <div className="form-fields-grid">
                  <div className="form-group">
                    <label htmlFor="priority-select">Priority Level</label>
                    <select
                      id="priority-select"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="assignee-input">Assign Technician/Worker</label>
                    <input
                      type="text"
                      id="assignee-input"
                      value={assignedTo}
                      onChange={(e) => setAssignedTo(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="category-select">Work Order Category</label>
                    <select
                      id="category-select"
                      value={workOrderSelection}
                      onChange={(e) => setWorkOrderSelection(e.target.value)}
                    >
                      <option value="">Select Category</option>
                      {categoryOptions.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="cost-input">Maintenance Cost (INR)</label>
                    <input
                      id="cost-input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={workOrderCost}
                      onChange={(e) => setWorkOrderCost(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="invoice-input">Invoice Number</label>
                    <input
                      id="invoice-input"
                      type="text"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      placeholder="e.g. REP-INV-1001"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="status-select">Work Order Status</label>
                    <select
                      id="status-select"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      disabled={selectedWO?.status === "Completed"}
                    >
                      <option value="Open">Open</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                </div>

                <hr className="drawer-divider" />

                {/* Tasks Grid Manager */}
                <div className="sub-grid-manager-block">
                  <div className="block-header">
                    <h3>Tasks Grid Manager</h3>
                    <button
                      type="button"
                      className="add-subrow-btn"
                      onClick={handleAddTask}
                      style={{ backgroundColor: "#2563eb", color: "#ffffff", border: "none" }}
                    >
                      Add New Task
                    </button>
                  </div>
                  
                  {tasks.length === 0 ? (
                    <p className="no-subrows-text">No active tasks. Click "Add New Task" to append procedural steps.</p>
                  ) : (
                    <div className="sub-grid-table-wrapper">
                      <table className="sub-grid-table">
                        <thead>
                          <tr>
                            <th>Task Name <span className="req">*</span></th>
                            <th>Description</th>
                            <th className="act-col">Remove</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tasks.map((task, idx) => (
                            <tr key={idx}>
                              <td>
                                <input
                                  type="text"
                                  value={task.taskName}
                                  placeholder="e.g. Diagnosing battery..."
                                  onChange={(e) => handleUpdateTaskField(idx, "taskName", e.target.value)}
                                  required
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  value={task.description}
                                  placeholder="e.g. Check voltage output levels..."
                                  onChange={(e) => handleUpdateTaskField(idx, "description", e.target.value)}
                                />
                              </td>
                              <td className="act-col">
                                <button
                                  type="button"
                                  className="delete-subrow-btn"
                                  onClick={() => handleDeleteTask(idx)}
                                >
                                  <FaTrash />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <hr className="drawer-divider" />

                {/* Checklist Grid Manager */}
                <div className="sub-grid-manager-block">
                  <div className="block-header">
                    <h3>Checklist Grid Manager</h3>
                    <button
                      type="button"
                      className="add-subrow-btn"
                      onClick={handleAddChecklist}
                      style={{ backgroundColor: "#2563eb", color: "#ffffff", border: "none" }}
                    >
                      Add New Check
                    </button>
                  </div>
                  
                  {checklists.length === 0 ? (
                    <p className="no-subrows-text">No checklist items. Click "Add New Check" to append post-repair procedures.</p>
                  ) : (
                    <div className="sub-grid-table-wrapper">
                      <table className="sub-grid-table">
                        <thead>
                          <tr>
                            <th>Check Name <span className="req">*</span></th>
                            <th>Description</th>
                            <th className="act-col">Remove</th>
                          </tr>
                        </thead>
                        <tbody>
                          {checklists.map((check, idx) => (
                            <tr key={idx}>
                              <td>
                                <input
                                  type="text"
                                  value={check.checkName}
                                  placeholder="e.g. Clean CPU Fan..."
                                  onChange={(e) => handleUpdateChecklistField(idx, "checkName", e.target.value)}
                                  required
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  value={check.description}
                                  placeholder="e.g. Free from dust..."
                                  onChange={(e) => handleUpdateChecklistField(idx, "description", e.target.value)}
                                />
                              </td>
                              <td className="act-col">
                                <button
                                  type="button"
                                  className="delete-subrow-btn"
                                  onClick={() => handleDeleteChecklist(idx)}
                                >
                                  <FaTrash />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Drawer Footer actions */}
              <div className="drawer-footer">
                <button
                  type="button"
                  className="drawer-cancel-btn"
                  onClick={() => setIsDrawerOpen(false)}
                  disabled={drawerLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="drawer-submit-btn"
                  disabled={drawerLoading}
                >
                  {drawerLoading ? (
                    <>
                      <FaSpinner className="spin" /> Saving Changes...
                    </>
                  ) : (
                    "Update Work Order"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkOrdersPage;
