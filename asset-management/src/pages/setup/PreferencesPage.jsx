import { useState } from "react";
import { PageTitle } from "../../components/common/ModuleComponents";
import { FaSave, FaSlidersH, FaEnvelope, FaBell, FaShieldAlt, FaPalette, FaHistory, FaEdit, FaTimes, FaCheck, FaBuilding, FaWrench } from "react-icons/fa";

export default function PreferencesPage() {
  const [activeTab, setActiveTab] = useState("general");
  const [toastMessage, setToastMessage] = useState("");
  
  // General Tab State
  const [generalPrefs, setGeneralPrefs] = useState({
    timeZone: "India Standard Time (IST)",
    timeFormat: "24 Hours",
    dateFormat: "dd-MMM-yy (15-Aug-47)",
    currency: "INR (₹)",
    currencyFormat: "1,234,567.89"
  });

  // ID Setup Tab State
  const [isEditingIdSetup, setIsEditingIdSetup] = useState(false);
  const [idSetup, setIdSetup] = useState({
    brand: "Brand ID -",
    product: "Product ID -",
    employee: "Emp ID -",
    request: "Req -",
    purchase: "PO -",
    asset: "Asset ID -",
    return: "Rtn Req ID -",
    complaint: "Comp ID -",
    service: "Service ID -",
    sparePart: "SP ID -"
  });
  const [tempIdSetup, setTempIdSetup] = useState({ ...idSetup });

  // Other Tabs State
  const [woTemplate, setWoTemplate] = useState({
    prefix: "WO-",
    slaDays: "3 Days",
    defaultPriority: "Medium",
    autoAssign: true,
    standardNotes: "Please perform preventive checklist and update safety logs."
  });

  const [emailTemplate, setEmailTemplate] = useState({
    senderEmail: "notifications@assetpro.internal",
    subjectPrefix: "[AssetPro] Asset Notification",
    headerText: "Dear Team,",
    bodyTemplate: "This is to notify you that asset {asset_name} (Model: {model}) has been successfully updated in your profile. Please verify."
  });

  const [organization, setOrganization] = useState({
    name: "AssetPro Enterprise Solutions",
    website: "https://assetpro.internal",
    address: "452 Silicon Valley, Tech Hub, CA 94025",
    supportContact: "admin@assetpro.internal"
  });

  const triggerToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(""), 3000);
  };

  // General Updates
  const handleGeneralUpdate = (e) => {
    e.preventDefault();
    triggerToast("General system settings updated successfully!");
  };

  const handleGeneralChange = (e) => {
    const { name, value } = e.target;
    setGeneralPrefs(prev => ({ ...prev, [name]: value }));
  };

  // ID Setup Updates
  const handleEditIdSetup = () => {
    setTempIdSetup({ ...idSetup });
    setIsEditingIdSetup(true);
  };

  const handleCancelIdSetup = () => {
    setIsEditingIdSetup(false);
  };

  const handleSaveIdSetup = () => {
    setIdSetup({ ...tempIdSetup });
    setIsEditingIdSetup(false);
    triggerToast("ID Naming prefixes updated successfully!");
  };

  const handleTempIdChange = (key, value) => {
    setTempIdSetup(prev => ({ ...prev, [key]: value }));
  };

  // WO updates
  const handleWoUpdate = (e) => {
    e.preventDefault();
    triggerToast("Work Order templates updated successfully!");
  };

  // Email updates
  const handleEmailUpdate = (e) => {
    e.preventDefault();
    triggerToast("Email templates updated successfully!");
  };

  // Organization updates
  const handleOrgUpdate = (e) => {
    e.preventDefault();
    triggerToast("Organization profile updated successfully!");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", paddingBottom: "32px" }}>
      <style>{`
        .pref-input, .pref-select, .pref-textarea {
          width: 100%;
          font-size: 13px;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          background-color: var(--bg-surface);
          color: var(--text-main);
          outline: none;
          box-shadow: var(--shadow-sm);
          transition: all 0.2s ease;
          box-sizing: border-box;
        }
        .pref-input, .pref-select {
          height: 42px;
          padding: 0 14px;
        }
        .pref-select {
          line-height: normal;
          padding-top: 0;
          padding-bottom: 0;
        }
        .pref-textarea {
          padding: 12px 14px;
          resize: vertical;
        }
        .pref-input:focus, .pref-select:focus, .pref-textarea:focus {
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px rgba(33, 133, 243, 0.15);
        }
        .pref-label {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .pref-button-submit {
          height: 40px;
          padding: 0 32px;
          font-size: 13px;
          font-weight: 600;
          border-radius: 8px;
          border: none;
          background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
          color: #ffffff;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(33, 133, 243, 0.2);
          transition: all 0.2s ease;
          outline: none;
          align-self: flex-start;
          width: fit-content;
        }
        .pref-button-submit:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(33, 133, 243, 0.3);
        }
        .pref-button-submit:active {
          transform: none;
        }
      `}</style>

      {/* Setup Page Header */}
      <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginBottom: "8px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: "700", color: "var(--text-main)", margin: 0 }}>Setup</h2>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>Configure your organization's profile, preferences and system parameters.</p>
      </div>

      {toastMessage && (
        <div style={{
          backgroundColor: "#ECFDF5",
          border: "1px solid #10B981",
          color: "#047857",
          padding: "12px 16px",
          borderRadius: "8px",
          fontWeight: "600",
          fontSize: "14px",
          boxShadow: "var(--shadow-sm)"
        }}>
          {toastMessage}
        </div>
      )}

      {/* Modern Setup Layout Card */}
      <div style={{
        backgroundColor: "var(--bg-surface)",
        borderRadius: "14px",
        border: "1px solid var(--border-color)",
        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -4px rgba(0, 0, 0, 0.05), 0 0 1px rgba(0, 0, 0, 0.1)",
        display: "flex",
        minHeight: "580px",
        overflow: "hidden"
      }}>
        {/* Left Side: Navigation Menu */}
        <div style={{
          width: "240px",
          borderRight: "1px solid var(--border-color)",
          padding: "24px 16px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          flexShrink: 0,
          backgroundColor: "var(--bg-surface)"
        }}>
          {[
            { id: "general", label: "General", icon: <FaSlidersH /> },
            { id: "wo", label: "WO Templates", icon: <FaWrench /> },
            { id: "email", label: "Email Template", icon: <FaEnvelope /> },
            { id: "idSetup", label: "ID Setup", icon: <FaHistory /> },
            { id: "organization", label: "Organization", icon: <FaBuilding /> }
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setIsEditingIdSetup(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: "8px",
                  borderLeft: isActive ? "4px solid var(--color-primary)" : "4px solid transparent",
                  fontWeight: isActive ? "700" : "500",
                  fontSize: "14px",
                  textAlign: "left",
                  cursor: "pointer",
                  backgroundColor: isActive ? "rgba(33, 133, 243, 0.08)" : "transparent",
                  color: isActive ? "var(--color-primary)" : "var(--text-muted)",
                  transition: "all 0.2s ease",
                  outline: "none",
                  borderTop: "none",
                  borderRight: "none",
                  borderBottom: "none",
                  boxSizing: "border-box"
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = "var(--bg-subtle)";
                    e.currentTarget.style.color = "var(--text-main)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "var(--text-muted)";
                  }
                }}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Side: Tab Panel Content */}
        <div style={{
          flexGrow: 1,
          padding: "36px 40px",
          backgroundColor: "var(--bg-surface)",
          overflowY: "auto"
        }}>
          
          {/* 1. GENERAL TAB */}
          {activeTab === "general" && (
            <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              <div style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "12px", marginBottom: "24px" }}>
                <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-main)", margin: 0 }}>General</h3>
              </div>

              <form onSubmit={handleGeneralUpdate} style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "480px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label className="pref-label">
                    Time Zone <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <select
                    name="timeZone"
                    value={generalPrefs.timeZone}
                    onChange={handleGeneralChange}
                    className="pref-select"
                  >
                    <option value="India Standard Time (IST)">India Standard Time (IST)</option>
                    <option value="Coordinated Universal Time (UTC)">Coordinated Universal Time (UTC)</option>
                    <option value="Eastern Standard Time (EST)">Eastern Standard Time (EST)</option>
                    <option value="Central Standard Time (CST)">Central Standard Time (CST)</option>
                  </select>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <label className="pref-label">
                    Time Format <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "var(--text-main)", cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="timeFormat"
                        value="12 Hours"
                        checked={generalPrefs.timeFormat === "12 Hours"}
                        onChange={handleGeneralChange}
                        style={{ width: "16px", height: "16px", accentColor: "var(--color-primary)" }}
                      />
                      12 Hours
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "var(--text-main)", cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="timeFormat"
                        value="24 Hours"
                        checked={generalPrefs.timeFormat === "24 Hours"}
                        onChange={handleGeneralChange}
                        style={{ width: "16px", height: "16px", accentColor: "var(--color-primary)" }}
                      />
                      24 Hours
                    </label>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label className="pref-label">
                    Date Format <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <select
                    name="dateFormat"
                    value={generalPrefs.dateFormat}
                    onChange={handleGeneralChange}
                    className="pref-select"
                  >
                    <option value="dd-MMM-yy (15-Aug-47)">dd-MMM-yy (15-Aug-47)</option>
                    <option value="dd/MM/yyyy (15/08/2047)">dd/MM/yyyy (15/08/2047)</option>
                    <option value="MM/dd/yyyy (08/15/2047)">MM/dd/yyyy (08/15/2047)</option>
                    <option value="yyyy-MM-dd (2047-08-15)">yyyy-MM-dd (2047-08-15)</option>
                  </select>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label className="pref-label">
                    Currency <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <select
                    name="currency"
                    value={generalPrefs.currency}
                    onChange={handleGeneralChange}
                    className="pref-select"
                  >
                    <option value="INR (₹)">INR (₹)</option>
                    <option value="USD ($)">USD ($)</option>
                    <option value="EUR (€)">EUR (€)</option>
                    <option value="GBP (£)">GBP (£)</option>
                  </select>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label className="pref-label">
                    Currency Format <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <select
                    name="currencyFormat"
                    value={generalPrefs.currencyFormat}
                    onChange={handleGeneralChange}
                    className="pref-select"
                  >
                    <option value="1,234,567.89">1,234,567.89</option>
                    <option value="12,34,567.89">12,34,567.89</option>
                    <option value="1.234.567,89">1.234.567,89</option>
                  </select>
                </div>

                <button type="submit" className="pref-button-submit">
                  Update
                </button>
              </form>
            </div>
          )}

          {/* 2. ID SETUP TAB */}
          {activeTab === "idSetup" && (
            <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid var(--border-color)",
                paddingBottom: "12px",
                marginBottom: "24px"
              }}>
                <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-main)", margin: 0 }}>ID Setup</h3>
                
                {!isEditingIdSetup ? (
                  <button
                    onClick={handleEditIdSetup}
                    style={{
                      backgroundColor: "#ffffff",
                      color: "var(--color-primary)",
                      border: "1px solid var(--color-primary)",
                      borderRadius: "8px",
                      padding: "8px 18px",
                      fontWeight: "600",
                      fontSize: "13px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      transition: "all 0.2s ease"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "rgba(33, 133, 243, 0.05)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "#ffffff";
                    }}
                  >
                    <FaEdit /> Edit Prefixes
                  </button>
                ) : (
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={handleCancelIdSetup}
                      style={{
                        backgroundColor: "#ffffff",
                        color: "var(--text-muted)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "8px",
                        padding: "8px 16px",
                        fontWeight: "600",
                        fontSize: "13px",
                        cursor: "pointer",
                        transition: "all 0.2s ease"
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
                      onClick={handleSaveIdSetup}
                      className="pref-button-submit"
                      style={{ height: "36px", padding: "0 18px", display: "flex", alignItems: "center", gap: "6px" }}
                    >
                      <FaSave /> Save Prefixes
                    </button>
                  </div>
                )}
              </div>

              {/* ID Grid Section */}
              <div style={{
                backgroundColor: "var(--bg-subtle)",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                padding: "24px"
              }}>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                  gap: "24px"
                }}>
                  {[
                    { key: "brand", label: "Brand ID" },
                    { key: "product", label: "Product ID" },
                    { key: "employee", label: "Employee ID" },
                    { key: "request", label: "Asset Request ID" },
                    { key: "purchase", label: "Purchased ID" },
                    { key: "asset", label: "Asset ID" },
                    { key: "return", label: "Return ID" },
                    { key: "complaint", label: "Complaint ID" },
                    { key: "service", label: "Service ID" },
                    { key: "sparePart", label: "Spare Part ID" }
                  ].map((field) => (
                    <div key={field.key} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <span className="pref-label">
                        {field.label}
                      </span>
                      
                      {!isEditingIdSetup ? (
                        <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-main)", minHeight: "36px", display: "flex", alignItems: "center" }}>
                          {idSetup[field.key]}
                        </span>
                      ) : (
                        <input
                          type="text"
                          value={tempIdSetup[field.key]}
                          onChange={(e) => handleTempIdChange(field.key, e.target.value)}
                          className="pref-input"
                          style={{ height: "36px", padding: "0 12px" }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 3. WO TEMPLATE TAB */}
          {activeTab === "wo" && (
            <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              <div style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "12px", marginBottom: "24px" }}>
                <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-main)", margin: 0 }}>WO Templates</h3>
              </div>

              <form onSubmit={handleWoUpdate} style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "480px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label className="pref-label">Work Order Prefix</label>
                  <input
                    type="text"
                    value={woTemplate.prefix}
                    onChange={(e) => setWoTemplate({ ...woTemplate, prefix: e.target.value })}
                    className="pref-input"
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label className="pref-label">Default SLA Resolution</label>
                  <select
                    value={woTemplate.slaDays}
                    onChange={(e) => setWoTemplate({ ...woTemplate, slaDays: e.target.value })}
                    className="pref-select"
                  >
                    <option value="1 Day">1 Day (Critical)</option>
                    <option value="3 Days">3 Days (Normal)</option>
                    <option value="7 Days">7 Days (Low Priority)</option>
                  </select>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label className="pref-label">Default Priority</label>
                  <select
                    value={woTemplate.defaultPriority}
                    onChange={(e) => setWoTemplate({ ...woTemplate, defaultPriority: e.target.value })}
                    className="pref-select"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label className="pref-label">Standard Maintenance Checklist & Guidelines</label>
                  <textarea
                    value={woTemplate.standardNotes}
                    onChange={(e) => setWoTemplate({ ...woTemplate, standardNotes: e.target.value })}
                    rows={4}
                    className="pref-textarea"
                  />
                </div>

                <button type="submit" className="pref-button-submit">
                  Update
                </button>
              </form>
            </div>
          )}

          {/* 4. EMAIL TEMPLATE TAB */}
          {activeTab === "email" && (
            <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              <div style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "12px", marginBottom: "24px" }}>
                <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-main)", margin: 0 }}>Email Template</h3>
              </div>

              <form onSubmit={handleEmailUpdate} style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "480px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label className="pref-label">Sender Email Address</label>
                  <input
                    type="email"
                    value={emailTemplate.senderEmail}
                    onChange={(e) => setEmailTemplate({ ...emailTemplate, senderEmail: e.target.value })}
                    className="pref-input"
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label className="pref-label">System Subject Prefix</label>
                  <input
                    type="text"
                    value={emailTemplate.subjectPrefix}
                    onChange={(e) => setEmailTemplate({ ...emailTemplate, subjectPrefix: e.target.value })}
                    className="pref-input"
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label className="pref-label">Email Salutation Header</label>
                  <input
                    type="text"
                    value={emailTemplate.headerText}
                    onChange={(e) => setEmailTemplate({ ...emailTemplate, headerText: e.target.value })}
                    className="pref-input"
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label className="pref-label">Rich Text Body Template</label>
                  <textarea
                    value={emailTemplate.bodyTemplate}
                    onChange={(e) => setEmailTemplate({ ...emailTemplate, bodyTemplate: e.target.value })}
                    rows={5}
                    className="pref-textarea"
                  />
                </div>

                <button type="submit" className="pref-button-submit">
                  Update
                </button>
              </form>
            </div>
          )}

          {/* 5. ORGANIZATION TAB */}
          {activeTab === "organization" && (
            <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              <div style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "12px", marginBottom: "24px" }}>
                <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-main)", margin: 0 }}>Organization Profile</h3>
              </div>

              <form onSubmit={handleOrgUpdate} style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "480px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label className="pref-label">Organization Name</label>
                  <input
                    type="text"
                    value={organization.name}
                    onChange={(e) => setOrganization({ ...organization, name: e.target.value })}
                    className="pref-input"
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label className="pref-label">Corporate Website</label>
                  <input
                    type="url"
                    value={organization.website}
                    onChange={(e) => setOrganization({ ...organization, website: e.target.value })}
                    className="pref-input"
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label className="pref-label">Main headquarters HQ Address</label>
                  <textarea
                    value={organization.address}
                    onChange={(e) => setOrganization({ ...organization, address: e.target.value })}
                    rows={3}
                    className="pref-textarea"
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label className="pref-label">Corporate Support Hotline email</label>
                  <input
                    type="email"
                    value={organization.supportContact}
                    onChange={(e) => setOrganization({ ...organization, supportContact: e.target.value })}
                    className="pref-input"
                  />
                </div>

                <button type="submit" className="pref-button-submit">
                  Update
                </button>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

