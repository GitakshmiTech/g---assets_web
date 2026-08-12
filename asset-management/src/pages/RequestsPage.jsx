import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  DataTable,
} from "../components/common/ModuleComponents";
import ConfirmDeleteModal from "../components/common/ConfirmDeleteModal";
import { deleteAsset, fetchAssetList, updateAsset } from "../store/slices/assetSlice";
import { getRequestRecords } from "../utils/assetUtils";
import { useToast } from "../components/toast/toastStore";
import {
  APPROVAL_PENDING,
  buildApprovalPayload,
  buildRejectionPayload,
  canDeleteRequest,
  canEditRequest,
  getNextApprovalStep,
  getChangeableApprovalStep,
  isRequestFullyApproved,
  isRequestRejected,
} from "../utils/requestWorkflow";
import {
  FaCheckCircle,
  FaTimes,
  FaSyncAlt,
  FaClipboardCheck,
  FaSearch,
  FaFilter,
  FaPlus,
  FaEdit,
  FaTrash,
} from "react-icons/fa";
import { usePermissions } from "../hooks/usePermissions";
import "./RequestsPage.css";

export function Requests() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermission, isAdmin } = usePermissions();
  
  const getInitials = (name) => {
    if (!name || name === "Unknown") return "👤";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const { assetListData } = useSelector(
    (state) => state.assetList
  );
  const { user } = useSelector((state) => state.auth);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    dispatch(fetchAssetList());
  }, [dispatch]);

  const isEmployee = user?.role === "EMPLOYEE";
  const userEmail = user?.email?.toLowerCase();
  const userName = user?.name?.toLowerCase();
  const userEmpId = user?.employeeId?.toLowerCase();

  const rawRequests = getRequestRecords(assetListData).filter((item) => {
    if (!isEmployee) return true;
    const itemEmail = item.employeeEmail?.toLowerCase();
    const itemReqBy = item.requestedBy?.toLowerCase();
    const itemEmpId = item.employeeId?.toLowerCase();

    return (
      (userEmail && itemEmail === userEmail) ||
      (userName && itemReqBy === userName) ||
      (userEmpId && itemEmpId === userEmpId)
    );
  });

  // Group requests by requestId
  const groupedRequests = [];
  const requestGroups = {};

  rawRequests.forEach((item) => {
    const reqId = item.requestId || "Unknown";
    if (!requestGroups[reqId]) {
      requestGroups[reqId] = {
        _id: item._id, // Keep one ID for keying/modals if needed
        requestId: reqId,
        requestedBy: item.requestedBy || "Unknown",
        requestedByPhoto: item.requestedByPhoto || "",
        requestDate: item.requestDate || item.createdAt,
        reportingTo: item.reportingTo || "Admin\ncreatorindustrysolutions",
        items: [],
      };
    }
    requestGroups[reqId].items.push(item);
  });

  const getGroupStatus = (group) => {
    const allApproved = group.items.every(item => item.requestStatus === "Approved" || (item.managerApproval === "Approved" && item.adminApproval === "Approved"));
    const anyRejected = group.items.some(item => item.requestStatus === "Rejected" || item.managerApproval === "Rejected" || item.adminApproval === "Rejected");
    const anyPORaised = group.items.some(item => String(item.purchaseStatus || item.requestStatus).toLowerCase().includes("po") || String(item.purchaseStatus || item.requestStatus).toLowerCase().includes("progress"));
    const anyCompleted = group.items.every(item => item.requestStatus === "Completed" || item.requestStatus === "Delivered");

    if (anyCompleted) return "Completed";
    if (anyRejected) return "Rejected";
    if (anyPORaised) return "PO Raised";
    if (allApproved) return "Approved";
    return "Requested";
  };

  Object.keys(requestGroups).forEach((key) => {
    const group = requestGroups[key];
    group.status = getGroupStatus(group);
    groupedRequests.push(group);
  });

  // Sort groups descending by numeric request ID if possible
  groupedRequests.sort((a, b) => {
    const numA = parseInt(a.requestId.replace(/\D/g, ""), 10) || 0;
    const numB = parseInt(b.requestId.replace(/\D/g, ""), 10) || 0;
    if (numA && numB) return numB - numA;
    return new Date(b.requestDate) - new Date(a.requestDate);
  });

  // Date Formatter matching: e.g. "18-May-26"
  const formatDate = (dateVal) => {
    if (!dateVal) return "-";
    const d = new Date(dateVal);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const day = d.getDate();
    const month = months[d.getMonth()];
    const year = d.getFullYear().toString().substr(-2);
    return `${day}-${month}-${year}`;
  };

  // Date Formatter matching: e.g. "18-May-26"
  const requestedCount = groupedRequests.filter((item) => item.status === "Requested" || item.status === "Pending").length;
  const approvedCount = groupedRequests.filter((item) => item.status === "Approved").length;
  const inProgressCount = groupedRequests.filter((item) => item.status === "PO Raised" || item.status === "In Progress").length;
  const completedCount = groupedRequests.filter((item) => item.status === "Completed").length;
  const totalCount = groupedRequests.length;

  // Filtering based on search and status filter
  const filteredRequests = groupedRequests.filter((group) => {
    // 1. Status Filter
    let matchesStatus = true;
    if (statusFilter !== "ALL") {
      if (statusFilter === "Requested") {
        matchesStatus = group.status === "Requested" || group.status === "Pending";
      } else if (statusFilter === "Approved") {
        matchesStatus = group.status === "Approved";
      } else if (statusFilter === "In Progress") {
        matchesStatus = group.status === "PO Raised" || group.status === "In Progress";
      } else if (statusFilter === "Completed") {
        matchesStatus = group.status === "Completed";
      } else {
        matchesStatus = group.status === statusFilter;
      }
    }

    // 2. Search Text
    const searchLower = search.toLowerCase();
    const matchesSearch =
      group.requestId.toLowerCase().includes(searchLower) ||
      group.requestedBy.toLowerCase().includes(searchLower) ||
      group.items.some(
        (item) =>
          String(item.brand || "").toLowerCase().includes(searchLower) ||
          String(item.category || "").toLowerCase().includes(searchLower) ||
          String(item.subCategory || "").toLowerCase().includes(searchLower) ||
          String(item.assetName || "").toLowerCase().includes(searchLower)
      );

    return matchesStatus && matchesSearch;
  });

  const renderRequestId = (id) => (
    <strong style={{ color: "#0ea5e9", fontFamily: "monospace", fontSize: "14px", fontWeight: "600" }}>
      {id}
    </strong>
  );

  const requestColumns = [
    {
      key: "requestId",
      label: "Request ID",
      render: (row) => renderRequestId(row.requestId),
    },
    {
      key: "requestedBy",
      label: "Requested By",
      render: (row) => (
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {row.requestedByPhoto ? (
            <img
              src={row.requestedByPhoto}
              alt={row.requestedBy}
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                objectFit: "cover"
              }}
            />
          ) : (
            <div style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              backgroundColor: "#eff6ff",
              color: "#1e40af",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "bold",
              fontSize: "12px"
            }}>
              {getInitials(row.requestedBy)}
            </div>
          )}
          <span style={{ fontWeight: "500", color: "#1e293b" }}>{row.requestedBy}</span>
        </div>
      )
    },
    {
      key: "reportingTo",
      label: "Reporting To",
      render: (row) => (
        <div style={{ fontSize: "13px", color: "#64748b", whiteSpace: "pre-line", lineHeight: "1.4", maxWidth: "160px", wordBreak: "break-word" }}>
          {row.reportingTo}
        </div>
      )
    },
    {
      key: "productsList",
      label: "Products List",
      render: (row) => (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxWidth: "260px", whiteSpace: "normal" }}>
          {row.items.map((item, idx) => (
            <div key={idx} style={{ fontSize: "13px", color: "#334155", lineHeight: "1.5", whiteSpace: "normal" }}>
              {item.brand || "Generic"} | {item.assetName || item.category} - {item.subCategory || item.category} | {item.quantity || 1} | <span style={{
                color: item.requestStatus === "Approved" ? "#10b981" : item.requestStatus === "Rejected" ? "#ef4444" : "#f59e0b",
                fontWeight: "600",
                fontSize: "12px",
                whiteSpace: "nowrap"
              }}>{item.requestStatus || "Requested"}</span>
            </div>
          ))}
        </div>
      )
    },
    {
      key: "requestDate",
      label: "Requested Date",
      render: (row) => (
        <span style={{ fontSize: "13px", color: "#334155", fontWeight: "500" }}>
          {formatDate(row.requestDate)}
        </span>
      )
    },
    {
      key: "status",
      label: "Status",
      render: (row) => {
        const s = row.status;
        let style = { color: "#64748b", background: "#f1f5f9", border: "1px solid #cbd5e1" };
        if (s === "Approved") {
          style = { color: "#10b981", background: "#ecfdf5", border: "1px solid #a7f3d0" };
        } else if (s === "PO Raised" || s === "In Progress") {
          style = { color: "#f59e0b", background: "#fffbeb", border: "1px solid #fef3c7" };
        } else if (s === "Completed") {
          style = { color: "#0ea5e9", background: "#f0f9ff", border: "1px solid #bae6fd" };
        } else if (s === "Rejected") {
          style = { color: "#ef4444", background: "#fef2f2", border: "1px solid #fecaca" };
        } else if (s === "Requested" || s === "Pending") {
          style = { color: "#0d9488", background: "#f0fdfa", border: "1px solid #ccfbf1" };
        }
        return (
          <span style={{
            fontSize: "12px",
            fontWeight: "600",
            padding: "4px 10px",
            borderRadius: "12px",
            display: "inline-block",
            ...style
          }}>
            {s}
          </span>
        );
      }
    },
    {
      key: "action",
      label: "Action",
      render: (row) => {
        const isEditable = row.status === "Requested" || row.status === "Pending";
        return (
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => {
                if (isEditable) {
                  navigate(`/edit-request/${row.requestId}`);
                }
              }}
              disabled={!isEditable}
              style={{
                backgroundColor: isEditable ? "#fffbeb" : "#f8fafc",
                color: isEditable ? "#ca8a04" : "#cbd5e1",
                border: `1px solid ${isEditable ? "#fef08a" : "#e2e8f0"}`,
                width: "32px",
                height: "32px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "6px",
                cursor: isEditable ? "pointer" : "not-allowed",
                transition: "all 0.15s ease",
                padding: 0,
              }}
              title={isEditable ? "Edit Request" : "Processed request cannot be edited"}
            >
              <FaEdit size={14} />
            </button>
            <button
              onClick={() => {
                if (isEditable) {
                  setDeleteTarget(row);
                }
              }}
              disabled={!isEditable}
              style={{
                backgroundColor: isEditable ? "#fef2f2" : "#f8fafc",
                color: isEditable ? "#ef4444" : "#cbd5e1",
                border: `1px solid ${isEditable ? "#fee2e2" : "#e2e8f0"}`,
                width: "32px",
                height: "32px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "6px",
                cursor: isEditable ? "pointer" : "not-allowed",
                transition: "all 0.15s ease",
                padding: 0,
              }}
              title={isEditable ? "Delete Request" : "Processed request cannot be deleted"}
            >
              <FaTrash size={14} />
            </button>
          </div>
        );
      }
    }
  ];

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const deletePromises = deleteTarget.items.map(item => dispatch(deleteAsset(item._id)).unwrap());
      await Promise.all(deletePromises);
      showToast({ title: "Request deleted", message: "The request group was removed successfully." });
    } catch (error) {
      showToast({
        title: "Delete failed",
        message: error || "Unable to delete request.",
        type: "error",
      });
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="dashboard-container requests-page-container">
      {/* Header Row */}
      <div className="dashboard-header-row">
        <div className="hero-text-block">
          <h2>Requests</h2>
          <p>View and manage all organization asset procurement requests.</p>
        </div>
        {(hasPermission("requests.create") || hasPermission("request.create") || isAdmin) && (
          <button
            type="button"
            className="dashboard-add-btn "
            onClick={() => navigate("/add-request")}
            style={{
              backgroundColor: "#139686",
              color: "#ffffff",
              padding: "8px 16px",
              borderRadius: "8px",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 2px 4px rgba(37, 99, 235, 0.15)",
            }}
          >
            Add Request
          </button>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div
        className="kpi-cards-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: "16px",
        }}
      >
        {[
          {
            label: "Requested",
            value: requestedCount,
            icon: <FaSyncAlt />,
            color: "#0d9488",
            subtext: "Awaiting review",
          },
          {
            label: "Approved",
            value: approvedCount,
            icon: <FaCheckCircle />,
            color: "#3b82f6",
            subtext: "Ready for purchase",
          },
          {
            label: "In Progress",
            value: inProgressCount,
            icon: <FaSyncAlt className="spinning-icon" />,
            color: "#f59e0b",
            subtext: "PO Raised / Ordered",
          },
          {
            label: "Completed",
            value: completedCount,
            icon: <FaClipboardCheck />,
            color: "#10b981",
            subtext: "Fulfilled requests",
          },
          {
            label: "All Requests",
            value: totalCount,
            icon: <FaClipboardCheck />,
            color: "#4f46e5",
            subtext: "Cumulative requests",
          },
        ].map((kpi, idx) => (
          <div className="kpi-card-new" key={idx}>
            <div className="kpi-card-content">
              <span className="kpi-card-label" style={{ color: "#64748b" }}>
                {kpi.label}
              </span>
              <strong
                className="kpi-card-value"
                style={{ color: kpi.color, fontSize: "26px" }}
              >
                {kpi.value}
              </strong>
              <span className="kpi-card-subtext">{kpi.subtext}</span>
            </div>
            <div
              className="kpi-card-icon-container"
              style={{ color: kpi.color, backgroundColor: `${kpi.color}10` }}
            >
              {kpi.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Table & Filters Card */}
      <div
        className="bottom-card-large"
        style={{ display: "flex", flexDirection: "column", gap: "16px" }}
      >
        <div className="requests-toolbar">
          <div className="requests-toolbar-left">
            <div className="search-box-wrapper">
              <FaSearch className="search-icon" />
              <input
                type="text"
                placeholder="Requested By, Product, Request ID, etc..."
                className="search-input-premium"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="filter-wrapper">
              <span className="filter-label">
                <FaFilter style={{ fontSize: "11px" }} /> Filter By:
              </span>
              <select
                className="status-filter-premium"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">- Status -</option>
                <option value="Requested">Requested</option>
                <option value="Approved">Approved</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>
        </div>

        <div className="table-responsive-new">
          <DataTable
            columns={requestColumns}
            rows={filteredRequests}
            emptyText="No matching requests found"
          />
        </div>
      </div>

      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title="DELETE REQUEST GROUP?"
        message={
          deleteTarget
            ? `Delete request group "${deleteTarget.requestId}" permanently? This will remove all items in this request.`
            : ""
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

export default Requests;

