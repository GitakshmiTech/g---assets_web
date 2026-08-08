import React, { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { createCompany, updateCompany } from "./companySlice";
import { toast } from "react-hot-toast";
import { FaUpload, FaBuilding, FaChartLine, FaGlobe, FaEnvelope, FaPhone, FaCheckCircle, FaUser, FaLock, FaCheck, FaShieldAlt, FaEye, FaEyeSlash } from "react-icons/fa";
import "./CompanyForm.css";

function CompanyForm({ initialData = null, isEdit = false, isView = false }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  
  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm({
    mode: "onBlur",
    defaultValues: {
      companyName: "",
      industry: "",
      website: "",
      email: "",
      phone: "",
      status: "Active",
      adminName: "",
      adminEmail: "",
      adminPassword: "",
      logo: ""
    }
  });

  const logoValue = watch("logo");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (initialData) {
      reset(initialData);
    }
  }, [initialData, reset]);

  const handleLogoUpload = (e) => {
    if (isView) return;
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setSubmitError("Logo must be under 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setValue("logo", reader.result, { shouldValidate: true });
        setSubmitError("");
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data) => {
    setSubmitting(true);
    setSubmitError("");
    try {
      if (isEdit) {
        await dispatch(updateCompany({ id: data._id, data })).unwrap();
      } else {
        await dispatch(createCompany(data)).unwrap();
      }
      toast.success(isEdit ? "Company updated successfully!" : "Company created successfully!");
      navigate("/super-admin/companies");
    } catch (err) {
      const errorMsg = typeof err === "string" ? err : (err?.message || "Something went wrong");
      setSubmitError(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="company-form-container">
      <div className="form-header">
        <div style={{ textAlign: 'left', width: '100%' }}>
          <h2>{isView ? "View Company" : isEdit ? "Edit Company" : "Add New Company"}</h2>
          {!isView && !isEdit && <span className="subtitle">ESTABLISH A NEW ENTERPRISE PARTNER</span>}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="company-form">
        {submitError && <div className="error-alert">{submitError}</div>}
        
        <div className="form-grid">
          <div className="form-group full-width">
            <label>COMPANY LOGO</label>
            <div className="logo-upload-wrapper">
              {!isView ? (
                <label htmlFor="logoUpload" style={{ cursor: 'pointer' }}>
                  {logoValue ? (
                    <img src={logoValue} alt="Logo" className="logo-preview" />
                  ) : (
                    <div className="logo-placeholder"><FaUpload size={24}/></div>
                  )}
                </label>
              ) : (
                logoValue ? (
                  <img src={logoValue} alt="Logo" className="logo-preview" />
                ) : (
                  <div className="logo-placeholder"><FaUpload size={24}/></div>
                )
              )}
              {!isView && (
                <input type="file" id="logoUpload" accept=".png,.jpg,.jpeg" onChange={handleLogoUpload} style={{ display: 'none' }} />
              )}
            </div>
          </div>

          <div className="form-group">
            <label>COMPANY NAME <span className="req-star">*</span></label>
            <div className="input-icon-wrapper">
              <FaBuilding className="input-icon" />
              <input 
                type="text" 
                placeholder="Company Name"
                className={errors.companyName ? "error-input" : ""}
                disabled={isView}
                {...register("companyName", { 
                  required: "Company Name is required.",
                  minLength: { value: 3, message: "Minimum 3 characters required." },
                  maxLength: { value: 100, message: "Maximum 100 characters allowed." }
                })} 
              />
            </div>
            {errors.companyName && <span className="validation-error">{errors.companyName.message}</span>}
          </div>

          <div className="form-group">
            <label>INDUSTRY/DOMAIN</label>
            <div className="input-icon-wrapper">
              <FaChartLine className="input-icon" />
              <input type="text" placeholder="Technology, Real Estate, etc." disabled={isView} {...register("industry")} />
            </div>
          </div>

          <div className="form-group">
            <label>OFFICIAL WEBSITE</label>
            <div className="input-icon-wrapper">
              <FaGlobe className="input-icon" />
              <input type="text" placeholder="https://example.com" disabled={isView} {...register("website")} />
            </div>
          </div>

          <div className="form-group">
            <label>CONTACT EMAIL <span className="req-star">*</span></label>
            <div className="input-icon-wrapper">
              <FaEnvelope className="input-icon" />
              <input 
                type="email" 
                placeholder="corp@example.com"
                className={errors.email ? "error-input" : ""}
                disabled={isView}
                {...register("email", { 
                  required: "Email is required.",
                  pattern: { value: /^\S+@\S+\.\S+$/, message: "Invalid email format." }
                })} 
              />
            </div>
            {errors.email && <span className="validation-error">{errors.email.message}</span>}
          </div>

          <div className="form-group">
            <label>CONTACT PHONE <span className="req-star">*</span></label>
            <div className="input-icon-wrapper">
              <FaPhone className="input-icon" />
              <input 
                type="text" 
                placeholder="+1 (000) 000-0000"
                className={errors.phone ? "error-input" : ""}
                disabled={isView}
                {...register("phone", { 
                  required: "Phone is required.",
                  pattern: { value: /^\d{10,15}$/, message: "Must be 10-15 digits." }
                })} 
              />
            </div>
            {errors.phone && <span className="validation-error">{errors.phone.message}</span>}
          </div>

          {!isView && (
            <div className="form-group">
              <label>STATUS</label>
              <div className="input-icon-wrapper">
                <FaCheckCircle className="input-icon" />
                <select {...register("status")}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {!isView && (
          <div className="admin-provisioning-section">
            <div className="section-title">
              <FaShieldAlt /> ADMIN PROVISIONING
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label>ADMIN NAME <span className="req-star">*</span></label>
                <div className="input-icon-wrapper">
                  <FaUser className="input-icon" />
                  <input 
                    type="text" 
                    placeholder="Admin Full Name"
                    className={errors.adminName ? "error-input" : ""}
                    {...register("adminName", { required: "Admin Name is required." })} 
                  />
                </div>
                {errors.adminName && <span className="validation-error">{errors.adminName.message}</span>}
              </div>

              <div className="form-group">
                <label>ADMIN LOGIN EMAIL <span className="req-star">*</span></label>
                <div className="input-icon-wrapper">
                  <FaEnvelope className="input-icon" />
                  <input 
                    type="email" 
                    placeholder="admin@company.com"
                    className={errors.adminEmail ? "error-input" : ""}
                    {...register("adminEmail", { 
                      required: "Admin Email is required.",
                      pattern: { value: /^\S+@\S+\.\S+$/, message: "Invalid email format." }
                    })} 
                  />
                </div>
                {errors.adminEmail && <span className="validation-error">{errors.adminEmail.message}</span>}
              </div>

              <div className="form-group">
                <label>ADMIN PASSWORD {!isEdit && <span className="req-star">*</span>}</label>
                <div className="input-icon-wrapper">
                  <FaLock className="input-icon" />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="********"
                    className={errors.adminPassword ? "error-input" : ""}
                    {...register("adminPassword", { 
                      required: isEdit ? false : "Password is required.",
                      minLength: { value: 6, message: "Minimum 6 characters." }
                    })} 
                  />
                  <div 
                    className="password-toggle-icon" 
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: "#6c757d" }}
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </div>
                </div>
                {errors.adminPassword && <span className="validation-error">{errors.adminPassword.message}</span>}
              </div>
            </div>
          </div>
        )}

        {!isView && (
          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={() => navigate("/super-admin/companies")}>CANCEL</button>
            <button type="submit" className="btn-save" disabled={submitting}>
              <FaCheck /> {submitting ? "SAVING..." : (isEdit ? "SAVE COMPANY DETAILS" : "CONFIRM ONBOARDING")}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

export default CompanyForm;
