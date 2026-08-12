import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { addAsset, updateAsset, fetchAssetList } from "../store/slices/assetSlice";
import { useToast } from "../components/toast/toastStore";
import { getRequestFormSections, loadRequestFormConfig } from "../utils/assetFormBuilder";
import { pushAppNotification } from "../utils/notificationStore";
import "./AddRequestPage.css";

export default function AddRequestPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const { showToast } = useToast();
  const { user } = useSelector((state) => state.auth);
  const isEmployee = user?.role === "EMPLOYEE";
  const { assetListData } = useSelector((state) => state.assetList);
  
  const [formConfig, setFormConfig] = useState(() => loadRequestFormConfig());
  const formSections = getRequestFormSections(formConfig);

  useEffect(() => {
    const syncBuilderConfig = () => {
      setFormConfig(loadRequestFormConfig());
    };
    const syncStorageConfig = (e) => {
      if (e.key === "formConfig_REQUEST") {
        setFormConfig(loadRequestFormConfig());
      }
    };
    window.addEventListener("form-builder-updated", syncBuilderConfig);
    window.addEventListener("asset-form-builder-updated", syncBuilderConfig);
    window.addEventListener("storage", syncStorageConfig);
    return () => {
      window.removeEventListener("form-builder-updated", syncBuilderConfig);
      window.removeEventListener("asset-form-builder-updated", syncBuilderConfig);
      window.removeEventListener("storage", syncStorageConfig);
    };
  }, []);
  
  const [formData, setFormData] = useState({
    requestType: "",
    requestStatus: "Pending",
    managerApproval: "Pending",
    adminApproval: "Pending",
    purchaseStatus: "Pending",
    requestDate: new Date().toISOString().split("T")[0]
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    dispatch(fetchAssetList());
  }, [dispatch]);

  useEffect(() => {
    if (isEditMode && assetListData.length > 0) {
      const existingItems = assetListData.filter(
        (item) => item.recordType === "REQUEST" && item.requestId === id
      );
      if (existingItems.length > 0) {
        const item = existingItems[0];
        
        let customFieldData = {};
        if (item.customFields) {
          Object.keys(item.customFields).forEach(key => {
            const fieldName = key.split('.')[1];
            if (fieldName) {
              const matchedField = formSections.flatMap(s => s.fields).find(f => f.label === fieldName);
              if (matchedField) {
                customFieldData[matchedField.name] = item.customFields[key];
              }
            }
          });
        }

        setFormData({
          ...item,
          ...customFieldData
        });
      }
    } else if (!isEditMode && user) {
      setFormData(prev => ({
        ...prev,
        requestedBy: user.name || user.username || "",
        employeeEmail: user.email || "",
        requestDate: new Date().toISOString().split("T")[0]
      }));
    }
  }, [isEditMode, assetListData, id, user, formSections]);

  const handleChange = (e, field) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name] && value.trim() !== "") {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const isFieldVisible = (name) => formConfig[name]?.visible !== false;
  const isFieldRequired = (name) => formConfig[name]?.required === true;

  const generateReqId = () => {
    let maxNum = 100;
    if (Array.isArray(assetListData)) {
      assetListData.forEach((item) => {
        if (item && item.requestId) {
          const match = String(item.requestId).match(/\d+/);
          if (match) {
            const num = parseInt(match[0], 10);
            if (num > maxNum) maxNum = num;
          }
        }
      });
    }
    return `Req-${maxNum + 1}`;
  };

  const handleSubmit = async (e) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }

    const missingRequired = {};
    formSections.forEach(section => {
      section.fields.forEach(field => {
        const value = formData[field.name];
        const isEmpty = value === undefined || value === null || String(value).trim() === "";
        if (isFieldVisible(field.name) && isFieldRequired(field.name) && isEmpty) {
          missingRequired[field.name] = `${field.label} is required`;
        } else if (isFieldVisible(field.name) && field.name === "price" && !isEmpty && Number.isNaN(Number(value))) {
          missingRequired[field.name] = "Estimated Cost must be a valid number";
        }
      });
    });

    if (Object.keys(missingRequired).length > 0) {
      console.log("Validation errors blocking form submission:", missingRequired);
      setErrors(missingRequired);
      showToast({
        title: "Validation Error",
        message: "Please fill in all required fields marked with *.",
        type: "error"
      });
      return;
    }

    try {
      const customFields = {};
      formSections.forEach(section => {
        section.fields.forEach(field => {
          if (field.custom) {
            customFields[`${section.title}.${field.label}`] = formData[field.name] || "";
          }
        });
      });

      const payload = {
        ...formData,
        recordType: "REQUEST",
        customFields
      };

      console.log("Submitting request form. Payload:", payload);

      if (!isEditMode) {
        payload.requestId = generateReqId();
        payload.requestDate = formData.requestDate || new Date().toISOString().split("T")[0];
        await dispatch(addAsset(payload)).unwrap();
        
        // Push notification to Admins
        try {
          pushAppNotification({
            title: "New Asset Request Submitted",
            message: `Employee ${user?.name || payload.requestedBy || "Someone"} submitted a request for ${payload.assetName || "an asset"}.`,
            type: "info",
            meta: {
              menuLabel: "Approvals",
              route: "/approvals",
              targetRoles: ["SUPER_ADMIN", "COMPANY_ADMIN", "ADMIN", "IT_STAFF"],
            }
          });
        } catch (err) {
          console.error("Failed to push request notification", err);
        }

        showToast({
          title: "Success",
          message: `Request created successfully.`,
          type: "success"
        });
      } else {
        await dispatch(updateAsset({ id: formData._id, payload })).unwrap();
        showToast({
          title: "Success",
          message: `Request updated successfully.`,
          type: "success"
        });
      }
      navigate("/requests");
    } catch (err) {
      console.error("Failed to save request:", err);
      showToast({
        title: "Error",
        message: err || "Unable to save request.",
        type: "error"
      });
    }
  };

  const renderField = (field) => {
    if (!isFieldVisible(field.name)) return null;

    const isSelect = ["requestType", "requestPriority", "requestStatus", "managerApproval", "adminApproval", "purchaseStatus"].includes(field.name);
    const isTextArea = ["requestReason"].includes(field.name);
    const isDate = ["requestDate", "expectedReturn"].includes(field.name);

    return (
      <div className={`field-group ${isTextArea ? "full-width" : ""}`} key={field.name}>
        <label>
          {field.label} {isFieldRequired(field.name) && <span className="req-star">*</span>}
        </label>
        
        {isSelect ? (
          <select
            name={field.name}
            value={formData[field.name] || ""}
            onChange={(e) => handleChange(e, field)}
            className={errors[field.name] ? "error" : ""}
          >
            <option value="">Select...</option>
            {field.name === "requestType" && (
              <>
                <option value="Procurement">Procurement</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Transfer">Transfer</option>
                <option value="Return">Return</option>
              </>
            )}
            {field.name === "requestPriority" && (
              <>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </>
            )}
            {["requestStatus", "managerApproval", "adminApproval"].includes(field.name) && (
              <>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </>
            )}
            {field.name === "purchaseStatus" && (
              <>
                <option value="Pending">Pending</option>
                <option value="Ordered">Ordered</option>
                <option value="Received">Received</option>
                <option value="Completed">Completed</option>
              </>
            )}
          </select>
        ) : isTextArea ? (
          <textarea
            name={field.name}
            value={formData[field.name] || ""}
            onChange={(e) => handleChange(e, field)}
            placeholder={`Enter ${field.label}`}
            rows={3}
            className={errors[field.name] ? "error" : ""}
          />
        ) : (
          <input
            type={isDate ? "date" : "text"}
            name={field.name}
            value={formData[field.name] || ""}
            onChange={(e) => handleChange(e, field)}
            placeholder={`e.g., ${field.label}`}
            className={errors[field.name] ? "error" : ""}
          />
        )}
        {errors[field.name] && <span className="field-error">{errors[field.name]}</span>}
      </div>
    );
  };

  return (
    <div className="add-request-container">
      <div className="catalog-header-bar">
        <div className="catalog-title">
          <h2>{isEditMode ? "Edit Request" : "New Asset Request"}</h2>
        </div>
        <div className="header-actions">
          <button type="button" className="cancel-btn" onClick={() => navigate("/requests")}>
            Cancel
          </button>
          <button 
            type="submit" 
            form="add-request-form" 
            className="submit-btn"
            onClick={handleSubmit}
          >
            Submit
          </button>
        </div>
      </div>

      <form id="add-request-form" onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {formSections.map((section, index) => {
          if (isEmployee && (section.title.includes("Approval") || section.title.includes("Purchase"))) {
            return null;
          }
          const visibleFields = section.fields.filter(f => isFieldVisible(f.name));
          if (visibleFields.length === 0) return null;

          return (
            <div className="dynamic-form-section" key={index}>
              <div className="section-header">
                <h3>{section.title}</h3>
                {section.description && <p>{section.description}</p>}
              </div>
              <div className="section-fields-grid">
                {section.fields.map(field => renderField(field))}
              </div>
            </div>
          );
        })}
      </form>
    </div>
  );
}
