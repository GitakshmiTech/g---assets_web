import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchAssetList, updateAsset } from "../store/slices/assetSlice";
import { getRequestRecords } from "../utils/assetUtils";
import { useToast } from "../components/toast/toastStore";
import {
  FaSearch,
  FaFilter,
  FaCheck,
  FaTimes,
  FaClipboardCheck,
  FaExclamationTriangle,
  FaArrowLeft,
  FaBoxes,
} from "react-icons/fa";
import { TablePagination, TablePageSizeSelector } from "../components/common/ModuleComponents";
import "./ApprovalsPage.css";

export function ApprovalsPage() {
  const dispatch = useDispatch();
  const { showToast } = useToast();
  const { assetListData, loading } = useSelector((state) => state.assetList);
  const [activeTab, setActiveTab] = useState("requests");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loadingId, setLoadingId] = useState("");

  const [reqPage, setReqPage] = useState(1);
  const [reqPageSize, setReqPageSize] = useState(20);
  const [compPage, setCompPage] = useState(1);
  const [compPageSize, setCompPageSize] = useState(20);
  const [retPage, setRetPage] = useState(1);
  const [retPageSize, setRetPageSize] = useState(20);

  useEffect(() => {
    setReqPage(1);
  }, [search, statusFilter, activeTab]);

  useEffect(() => {
    setCompPage(1);
  }, [search, statusFilter, activeTab]);

  useEffect(() => {
    setRetPage(1);
  }, [search, statusFilter, activeTab]);

  useEffect(() => {
    dispatch(fetchAssetList());
  }, [dispatch]);

  // Extract request records
  const requests = getRequestRecords(assetListData);

  const getInitials = (name) => {
    if (!name || name === "Unknown") return "👤";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Group requests by requestId
  const groupedRequests = [];
  const requestGroups = {};

  requests.forEach((item) => {
    const reqId = item.requestId || "Unknown";
    if (!requestGroups[reqId]) {
      requestGroups[reqId] = {
        requestId: reqId,
        requestedBy: item.requestedBy || "Unknown",
        requestedByPhoto: item.requestedByPhoto || "",
        requestDate: item.requestDate || item.createdAt,
        items: [],
      };
    }
    requestGroups[reqId].items.push(item);
  });

  Object.keys(requestGroups).forEach((key) => {
    const group = requestGroups[key];
    // Compute group status
    const allApproved = group.items.every((item) => item.requestStatus === "Approved");
    const anyRejected = group.items.some((item) => item.requestStatus === "Rejected");
    
    group.status = allApproved ? "Approved" : anyRejected ? "Rejected" : "Requested";
    groupedRequests.push(group);
  });

  // Sort groupedRequests descending (e.g. Req-135, Req-134, etc.)
  groupedRequests.sort((a, b) => {
    const numA = parseInt(a.requestId.replace(/\D/g, ""), 10) || 0;
    const numB = parseInt(b.requestId.replace(/\D/g, ""), 10) || 0;
    if (numA && numB) return numB - numA;
    return new Date(b.requestDate) - new Date(a.requestDate);
  });

  // Filter based on search and status dropdown
  const filteredGroups = groupedRequests.filter((group) => {
    let matchesStatus = true;
    if (statusFilter === "REQUESTED") {
      matchesStatus = group.status === "Requested";
    } else if (statusFilter === "APPROVED") {
      matchesStatus = group.status === "Approved";
    } else if (statusFilter === "REJECTED") {
      matchesStatus = group.status === "Rejected";
    }

    const searchLower = search.toLowerCase();
    const matchesSearch =
      group.requestId.toLowerCase().includes(searchLower) ||
      group.requestedBy.toLowerCase().includes(searchLower) ||
      group.items.some(
        (item) =>
          String(item.brand || "").toLowerCase().includes(searchLower) ||
          String(item.category || "").toLowerCase().includes(searchLower) ||
          String(item.subCategory || "").toLowerCase().includes(searchLower)
      );

    return matchesStatus && matchesSearch;
  });

  // Date Formatter matching screenshot: e.g. "18-May-26"
  const formatDate = (dateVal) => {
    if (!dateVal) return "-";
    const d = new Date(dateVal);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const day = d.getDate();
    const month = months[d.getMonth()];
    const year = d.getFullYear().toString().substr(-2);
    return `${day}-${month}-${year}`;
  };

  // Direct toggleable actions
  const handleApprove = async (group) => {
    setLoadingId(group.requestId);
    try {
      const updatePromises = group.items.map((item) => {
        const payload = {
          managerApproval: "Approved",
          adminApproval: "Approved",
          requestStatus: "Approved",
        };
        return dispatch(updateAsset({ id: item._id, payload })).unwrap();
      });

      await Promise.all(updatePromises);
      await dispatch(fetchAssetList());
      
      showToast({
        title: "✓ Request Approved",
        message: `${group.requestId} status updated: Approved.`,
        type: "success",
      });
    } catch (error) {
      showToast({
        title: "Approval failed",
        message: error || "Could not approve the request.",
        type: "error",
      });
    } finally {
      setLoadingId("");
    }
  };

  const handleReject = async (group) => {
    setLoadingId(group.requestId);
    try {
      const updatePromises = group.items.map((item) => {
        const payload = {
          managerApproval: "Rejected",
          adminApproval: "Rejected",
          requestStatus: "Rejected",
        };
        return dispatch(updateAsset({ id: item._id, payload })).unwrap();
      });

      await Promise.all(updatePromises);
      await dispatch(fetchAssetList());
      
      showToast({
        title: "✗ Request Rejected",
        message: `${group.requestId} status updated: Rejected.`,
        type: "info",
      });
    } catch (error) {
      showToast({
        title: "Rejection failed",
        message: error || "Could not reject the request.",
        type: "error",
      });
    } finally {
      setLoadingId("");
    }
  };

  // Mock complaints data
  const mockComplaints = [];

  const filteredComplaints = mockComplaints.filter((comp) => {
    let matchesStatus = true;
    if (statusFilter !== "ALL") {
      if (statusFilter === "AWAITING") {
        matchesStatus = comp.status === "Awaiting Check";
      } else if (statusFilter === "RESOLVED") {
        matchesStatus = comp.status === "Resolved";
      }
    }

    const searchLower = search.toLowerCase();
    const matchesSearch =
      comp.id.toLowerCase().includes(searchLower) ||
      comp.complainant.toLowerCase().includes(searchLower) ||
      comp.issue.toLowerCase().includes(searchLower);

    return matchesStatus && matchesSearch;
  });

  // Mock returns data
  const mockReturns = [];

  const filteredReturns = mockReturns.filter((ret) => {
    let matchesStatus = true;
    if (statusFilter !== "ALL") {
      if (statusFilter === "AWAITING") {
        matchesStatus = ret.status === "Awaiting Receipt";
      } else if (statusFilter === "RETURNED") {
        matchesStatus = ret.status === "Returned";
      }
    }

    const searchLower = search.toLowerCase();
    const matchesSearch =
      ret.id.toLowerCase().includes(searchLower) ||
      ret.employee.toLowerCase().includes(searchLower) ||
      ret.item.toLowerCase().includes(searchLower);

    return matchesStatus && matchesSearch;
  });

  const totalRequests = filteredGroups.length;
  const reqStartIndex = (reqPage - 1) * reqPageSize;
  const slicedRequests = filteredGroups.slice(reqStartIndex, reqStartIndex + reqPageSize);

  const totalComplaints = filteredComplaints.length;
  const compStartIndex = (compPage - 1) * compPageSize;
  const slicedComplaints = filteredComplaints.slice(compStartIndex, compStartIndex + compPageSize);

  const totalReturns = filteredReturns.length;
  const retStartIndex = (retPage - 1) * retPageSize;
  const slicedReturns = filteredReturns.slice(retStartIndex, retStartIndex + retPageSize);

  return (
    <div className="approvals-page-container">
      {/* Workspace Header */}
      <div className="approvals-header">
        <div className="hero-text-block">
          <h2>Approvals Workspace</h2>
          <p>Review and act on asset requests, service complaints, and device returns.</p>
        </div>
      </div>

      {/* Tabs Menu Navigation */}
      <div className="approvals-tabs-nav">
        <button
          className={`tab-btn ${activeTab === "requests" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("requests");
            setSearch("");
            setStatusFilter("ALL");
          }}
        >
          Asset Requests
        </button>
        <button
          className={`tab-btn ${activeTab === "complaints" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("complaints");
            setSearch("");
            setStatusFilter("ALL");
          }}
        >
          Complaints
        </button>
        <button
          className={`tab-btn ${activeTab === "returns" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("returns");
            setSearch("");
            setStatusFilter("ALL");
          }}
        >
          Asset Return
        </button>
      </div>

      {/* Main Tab Panels */}
      <div className="approvals-tab-panel">
        
        {/* TABS 1: ASSET REQUESTS */}
        {activeTab === "requests" && (
          <div className="approvals-panel-content">
            <div className="approvals-toolbar">
              <div className="toolbar-search-wrapper">
                <FaSearch className="search-icon" />
                <input
                  type="text"
                  placeholder="Search by ID, name, or product details..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="toolbar-filter-wrapper">
                <span className="filter-label">Filter By:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="ALL">- Status -</option>
                  <option value="REQUESTED">Requested</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>
                {totalRequests > 20 && (
                  <TablePageSizeSelector
                    pageSize={reqPageSize}
                    onPageSizeChange={(size) => {
                      setReqPageSize(size);
                      setReqPage(1);
                    }}
                  />
                )}
              </div>
            </div>

            <div className="module-table-card">
              <div className="module-table-scroll-area">
                <table className="custom-approvals-table">
                  <thead>
                    <tr>
                      <th>Request ID</th>
                      <th>Requested By</th>
                      <th>Products List</th>
                      <th>Requested Date</th>
                      <th>Status</th>
                      <th style={{ textAlign: "center" }}>Approve</th>
                      <th style={{ textAlign: "center" }}>Reject</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && slicedRequests.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: "center", padding: "40px 20px" }}>
                          <div className="loading-spinner"></div>
                          <p style={{ marginTop: "12px", color: "#64748b" }}>Loading approval requests...</p>
                        </td>
                      </tr>
                    ) : slicedRequests.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: "center", padding: "60px 20px", color: "#64748b" }}>
                          <FaClipboardCheck style={{ fontSize: "36px", color: "#cbd5e1", marginBottom: "12px" }} />
                          <p>No matching approval requests found.</p>
                        </td>
                      </tr>
                    ) : (
                      slicedRequests.map((group) => {
                        const isBusy = loadingId === group.requestId;
                        return (
                          <tr key={group.requestId} className={group.status === "Approved" ? "row-approved" : ""}>
                            <td className="col-req-id">
                              <span>{group.requestId}</span>
                            </td>
                            <td className="col-requested-by">
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                {group.requestedByPhoto ? (
                                  <img
                                    src={group.requestedByPhoto}
                                    alt={group.requestedBy}
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
                                    {getInitials(group.requestedBy)}
                                  </div>
                                )}
                                <span style={{ fontWeight: "500", color: "#1e293b" }}>{group.requestedBy}</span>
                              </div>
                            </td>
                            <td className="col-products-list">
                              <div className="products-list-stack">
                                {group.items.map((item, idx) => (
                                  <div key={idx} className="product-row-stack">
                                    {item.brand} | {item.category} - {item.subCategory} | {item.quantity || 1}
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td className="col-req-date">
                              {formatDate(group.requestDate)}
                            </td>
                            <td className="col-status">
                              <span className={`status-label text-${group.status.toLowerCase()}`}>
                                {group.status}
                              </span>
                            </td>
                            <td className="col-action-btn" style={{ textAlign: "center" }}>
                              <button
                                type="button"
                                className={`btn-approval btn-approval-approve ${group.status === "Approved" ? "active" : ""}`}
                                disabled={isBusy}
                                onClick={() => handleApprove(group)}
                              >
                                {group.status === "Approved" ? "Approved" : "Approve"}
                              </button>
                            </td>
                            <td className="col-action-btn" style={{ textAlign: "center" }}>
                              <button
                                type="button"
                                className={`btn-approval btn-approval-reject ${group.status === "Rejected" ? "active" : ""}`}
                                disabled={isBusy}
                                onClick={() => handleReject(group)}
                              >
                                {group.status === "Rejected" ? "Rejected" : "Reject"}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {totalRequests > 0 && (
                <TablePagination
                  totalItems={totalRequests}
                  currentPage={reqPage}
                  pageSize={reqPageSize}
                  onPageChange={setReqPage}
                  displayedCount={slicedRequests.length}
                />
              )}
            </div>
          </div>
        )}

        {/* TABS 2: COMPLAINTS */}
        {activeTab === "complaints" && (
          <div className="approvals-panel-content">
            <div className="approvals-toolbar">
              <div className="toolbar-search-wrapper">
                <FaSearch className="search-icon" />
                <input
                  type="text"
                  placeholder="Search by ID, complainant, or issue..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="toolbar-filter-wrapper">
                <span className="filter-label">Filter By:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="ALL">- Status -</option>
                  <option value="AWAITING">Awaiting Check</option>
                  <option value="RESOLVED">Resolved</option>
                </select>
                {totalComplaints > 20 && (
                  <TablePageSizeSelector
                    pageSize={compPageSize}
                    onPageSizeChange={(size) => {
                      setCompPageSize(size);
                      setCompPage(1);
                    }}
                  />
                )}
              </div>
            </div>

            <div className="module-table-card">
              <div className="module-table-scroll-area">
                <table className="custom-approvals-table">
                  <thead>
                    <tr>
                      <th>Complaint ID</th>
                      <th>Requested By</th>
                      <th>Service Details</th>
                      <th>Filed Date</th>
                      <th>Status</th>
                      <th style={{ textAlign: "center" }}>Resolve</th>
                      <th style={{ textAlign: "center" }}>Reject</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slicedComplaints.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: "center", padding: "60px 20px", color: "#64748b" }}>
                          <FaClipboardCheck style={{ fontSize: "36px", color: "#cbd5e1", marginBottom: "12px" }} />
                          <p>No matching service complaints found.</p>
                        </td>
                      </tr>
                    ) : (
                      slicedComplaints.map((comp) => (
                        <tr key={comp.id} className={comp.status === "Resolved" ? "row-approved" : ""}>
                          <td className="col-req-id">{comp.id}</td>
                          <td className="col-requested-by">{comp.complainant}</td>
                          <td>
                            <strong style={{ color: "#334155" }}>{comp.issue}</strong>
                          </td>
                          <td className="col-req-date">{comp.date}</td>
                          <td className="col-status">
                            <span className={`status-label text-${comp.status === "Resolved" ? "approved" : "requested"}`}>
                              {comp.status}
                            </span>
                          </td>
                          <td className="col-action-btn" style={{ textAlign: "center" }}>
                            <button
                              type="button"
                              className={`btn-approval btn-approval-approve ${comp.status === "Resolved" ? "active" : ""}`}
                              disabled={comp.status === "Resolved"}
                              onClick={() => {
                                showToast({ title: "Complaint Resolved", message: `${comp.id} successfully updated.` });
                              }}
                            >
                              {comp.status === "Resolved" ? "Resolved" : "Resolve"}
                            </button>
                          </td>
                          <td className="col-action-btn" style={{ textAlign: "center" }}>
                            <button
                              type="button"
                              className="btn-approval btn-approval-reject"
                              disabled={comp.status === "Resolved"}
                              onClick={() => {
                                showToast({ title: "Complaint Dismissed", message: `${comp.id} rejected.`, type: "info" });
                              }}
                            >
                              Reject
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {totalComplaints > 0 && (
                <TablePagination
                  totalItems={totalComplaints}
                  currentPage={compPage}
                  pageSize={compPageSize}
                  onPageChange={setCompPage}
                  displayedCount={slicedComplaints.length}
                />
              )}
            </div>
          </div>
        )}

        {/* TABS 3: ASSET RETURNS */}
        {activeTab === "returns" && (
          <div className="approvals-panel-content">
            <div className="approvals-toolbar">
              <div className="toolbar-search-wrapper">
                <FaSearch className="search-icon" />
                <input
                  type="text"
                  placeholder="Search by ID, employee, or item..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="toolbar-filter-wrapper">
                <span className="filter-label">Filter By:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="ALL">- Status -</option>
                  <option value="AWAITING">Awaiting Receipt</option>
                  <option value="RETURNED">Returned</option>
                </select>
                {totalReturns > 20 && (
                  <TablePageSizeSelector
                    pageSize={retPageSize}
                    onPageSizeChange={(size) => {
                      setRetPageSize(size);
                      setRetPage(1);
                    }}
                  />
                )}
              </div>
            </div>

            <div className="module-table-card">
              <div className="module-table-scroll-area">
                <table className="custom-approvals-table">
                  <thead>
                    <tr>
                      <th>Return ID</th>
                      <th>Requested By</th>
                      <th>Asset Details</th>
                      <th>Return Date</th>
                      <th>Status</th>
                      <th style={{ textAlign: "center" }}>Accept</th>
                      <th style={{ textAlign: "center" }}>Reject</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slicedReturns.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: "center", padding: "60px 20px", color: "#64748b" }}>
                          <FaClipboardCheck style={{ fontSize: "36px", color: "#cbd5e1", marginBottom: "12px" }} />
                          <p>No matching asset returns found.</p>
                        </td>
                      </tr>
                    ) : (
                      slicedReturns.map((ret) => (
                        <tr key={ret.id} className={ret.status === "Returned" ? "row-approved" : ""}>
                          <td className="col-req-id">{ret.id}</td>
                          <td className="col-requested-by">{ret.employee}</td>
                          <td>
                            <strong style={{ color: "#334155" }}>{ret.item}</strong>
                          </td>
                          <td className="col-req-date">{ret.date}</td>
                          <td className="col-status">
                            <span className={`status-label text-${ret.status === "Returned" ? "approved" : "requested"}`}>
                              {ret.status}
                            </span>
                          </td>
                          <td className="col-action-btn" style={{ textAlign: "center" }}>
                            <button
                              type="button"
                              className={`btn-approval btn-approval-approve ${ret.status === "Returned" ? "active" : ""}`}
                              disabled={ret.status === "Returned"}
                              onClick={() => {
                                showToast({ title: "Return Approved", message: `${ret.id} receipt confirmed.` });
                              }}
                            >
                              {ret.status === "Returned" ? "Received" : "Accept"}
                            </button>
                          </td>
                          <td className="col-action-btn" style={{ textAlign: "center" }}>
                            <button
                              type="button"
                              className="btn-approval btn-approval-reject"
                              disabled={ret.status === "Returned"}
                              onClick={() => {
                                showToast({ title: "Return Rejected", message: `${ret.id} declined.`, type: "info" });
                              }}
                            >
                              Reject
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {totalReturns > 0 && (
                <TablePagination
                  totalItems={totalReturns}
                  currentPage={retPage}
                  pageSize={retPageSize}
                  onPageChange={setRetPage}
                  displayedCount={slicedReturns.length}
                />
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default ApprovalsPage;
