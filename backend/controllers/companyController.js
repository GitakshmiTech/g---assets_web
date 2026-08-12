import Company from "../models/Company.js";
import Counter from "../models/Counter.js";
import User from "../models/User.js";
import mongoose from "mongoose";

const getNextSequenceValue = async (sequenceName) => {
  const lastCompany = await Company.findOne({ companyCode: { $regex: /^GT-\d+$/ } })
    .sort({ companyCode: -1 });

  let maxSeq = 0;
  if (lastCompany && lastCompany.companyCode) {
    const num = parseInt(lastCompany.companyCode.substring(3), 10);
    if (!isNaN(num)) {
      maxSeq = num;
    }
  }

  await Counter.findOneAndUpdate(
    { id: sequenceName },
    { $max: { seq: maxSeq } },
    { upsert: true }
  );

  const sequenceDocument = await Counter.findOneAndUpdate(
    { id: sequenceName },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return sequenceDocument.seq;
};

export const createCompany = async (req, res) => {
  try {
    const { 
      companyName, email, phone, gstNumber, address, country, state, city, logo, 
      industry, website, adminName, adminEmail, adminPassword 
    } = req.body;

    const cleanAdminEmail = adminEmail ? String(adminEmail).toLowerCase().trim() : "";
    if (cleanAdminEmail) {
      // Check if admin email already exists for super admin or standalone role
      const existingSuperAdmin = await User.findOne({ email: cleanAdminEmail, role: "SUPER_ADMIN" });
      if (existingSuperAdmin) {
        return res.status(400).json({
          success: false,
          message: "This email is reserved for Super Admin.",
          data: null,
        });
      }
    }

    // Generate Company Code
    const seq = await getNextSequenceValue("companyId");
    const companyCode = `GT-${seq.toString().padStart(4, "0")}`;

    const newCompany = new Company({
      companyName,
      companyCode,
      email,
      phone,
      gstNumber,
      address,
      country,
      state,
      city,
      logo,
      industry,
      website,
      createdBy: req.user ? req.user._id : undefined,
    });

    await newCompany.save();

    if (adminName && adminEmail && adminPassword) {
      const adminUser = new User({
        name: adminName,
        email: adminEmail,
        role: "COMPANY_ADMIN",
        companyId: newCompany._id,
        profilePhoto: logo || "",
      });
      adminUser.setPassword(adminPassword);
      await adminUser.save();
    }

    return res.status(201).json({
      success: true,
      message: "Company created successfully",
      data: newCompany,
    });
  } catch (error) {
    console.error("Create Company Error:", error);
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyValue)[0];
      return res.status(400).json({
        success: false,
        message: `A company with this ${duplicateField} already exists.`,
        data: null,
      });
    }
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create company",
      data: null,
    });
  }
};

export const listCompanies = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", sortBy = "createdAt", sortOrder = "desc" } = req.query;
    
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const query = { isDeleted: { $ne: true } };
    if (search) {
      query.$or = [
        { companyName: { $regex: search, $options: "i" } },
        { companyCode: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    const total = await Company.countDocuments(query);
    const companies = await Company.find(query).sort(sort).skip(skip).limit(limitNumber);

    return res.status(200).json({
      success: true,
      message: "Companies retrieved successfully",
      data: {
        companies,
        pagination: {
          total,
          page: pageNumber,
          limit: limitNumber,
          totalPages: Math.ceil(total / limitNumber),
        },
      },
    });
  } catch (error) {
    console.error("List Companies Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve companies",
      data: null,
    });
  }
};

export const getCompanyById = async (req, res) => {
  try {
    const { id } = req.params;
    const company = await Company.findOne({ _id: id, isDeleted: false });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
        data: null,
      });
    }

    let adminData = null;
    const admin = await User.findOne({ companyId: id, role: "COMPANY_ADMIN" });
    if (admin) {
      adminData = {
        adminName: admin.name,
        adminEmail: admin.email,
        adminPassword: admin.plainPassword || ""
      };
    }

    return res.status(200).json({
      success: true,
      message: "Company retrieved successfully",
      data: { ...company.toObject(), ...adminData },
    });
  } catch (error) {
    console.error("Get Company Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve company",
      data: null,
    });
  }
};

export const updateCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminName, adminEmail, adminPassword, ...updates } = req.body;

    if (adminEmail) {
      const cleanEmail = String(adminEmail).toLowerCase().trim();
      const existingUser = await User.findOne({ email: cleanEmail, companyId: id, role: { $ne: "COMPANY_ADMIN" } });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Another user in this company already uses this email.",
          data: null,
        });
      }
    }
    
    if (req.user) updates.updatedBy = req.user._id;

    const company = await Company.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
        data: null,
      });
    }

    if (adminName || adminEmail || adminPassword) {
      const admin = await User.findOne({ companyId: id, role: "COMPANY_ADMIN" });
      if (admin) {
        if (adminName) admin.name = adminName;
        if (adminEmail) admin.email = adminEmail;
        if (adminPassword) {
          admin.setPassword(adminPassword);
        }
        if (updates.logo) {
          admin.profilePhoto = updates.logo;
        }
        await admin.save();
      } else if (adminName && adminEmail && adminPassword) {
        const adminUser = new User({
          name: adminName,
          email: adminEmail,
          role: "COMPANY_ADMIN",
          companyId: company._id,
          profilePhoto: updates.logo || company.logo || "",
        });
        adminUser.setPassword(adminPassword);
        await adminUser.save();
      }
    }

    return res.status(200).json({
      success: true,
      message: "Company updated successfully",
      data: company,
    });
  } catch (error) {
    console.error("Update Company Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update company",
      data: null,
    });
  }
};

export const deleteCompany = async (req, res) => {
  try {
    const { id } = req.params;
    
    const company = await Company.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { 
        $set: { 
          isDeleted: true, 
          status: "Deleted", 
          updatedBy: req.user ? req.user._id : undefined 
        } 
      },
      { new: true }
    );

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
        data: null,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Company deleted successfully",
      data: null,
    });
  } catch (error) {
    console.error("Delete Company Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete company",
      data: null,
    });
  }
};
