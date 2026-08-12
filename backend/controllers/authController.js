import User from "../models/User.js";
import Role, { ensureDefaultRoles } from "../models/Role.js";
import { createToken } from "../utils/authToken.js";
import QRCode from "qrcode";
import { generateBase32Secret, verifyTOTP } from "../utils/totp.js";

import Company from "../models/Company.js";

const normalizeRole = async (role) => {
  await ensureDefaultRoles();
  const value = String(role || "EMPLOYEE").toUpperCase().replace(/[\s-]+/g, "_");
  const exists = await Role.exists({ key: value });
  return exists ? value : "EMPLOYEE";
};

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,30}$/;

const normalizeUsername = (value) => String(value || "").trim().toLowerCase();

const findUsersByIdentifier = async (identifier) => {
  const normalized = String(identifier || "").trim().toLowerCase();
  if (!normalized) return [];

  if (normalized.includes("@")) {
    let users = await User.find({ email: normalized });
    if (!users || users.length === 0) {
      const company = await Company.findOne({ email: normalized, isDeleted: { $ne: true } });
      if (company) {
        const companyAdmin = await User.findOne({ companyId: company._id, role: "COMPANY_ADMIN" });
        if (companyAdmin) users = [companyAdmin];
      }
    }
    return users || [];
  }

  return User.find({ $or: [{ username: normalized }, { employeeId: identifier.trim() }] });
};

const getAssetRedirectUri = (req) => {
  const origin = String(req.get("x-client-origin") || req.get("origin") || "").trim().replace(/\/+$/, "");
  if (origin) {
    try {
      const url = new URL(origin);
      if (url.protocol === "http:" || url.protocol === "https:") {
        return `${url.origin}/login`;
      }
    } catch {
      // Fall back to configured redirect URI.
    }
  }

  return process.env.GTONE_ASSET_REDIRECT_URI || process.env.ASSET_REDIRECT_URI || "http://localhost:5173/login";
};

const safeVerifyPassword = (user, password) => {
  if (!user || !user.passwordHash || !user.passwordSalt) return false;

  try {
    return user.verifyPassword(password);
  } catch (error) {
    console.warn(`Password verification failed for ${user.email}:`, error.message);
    return false;
  }
};

const buildUsernameFromEmail = (email) => {
  const localPart = String(email || "").split("@")[0] || "sso_user";
  const normalized = normalizeUsername(localPart).replace(/[^a-z0-9_]/g, "_").slice(0, 24);
  return USERNAME_PATTERN.test(normalized) ? normalized : `sso_${Date.now().toString(36)}`;
};

const ensureUniqueUsername = async (email) => {
  const base = buildUsernameFromEmail(email);
  let candidate = base;
  let suffix = 1;

  while (await User.exists({ username: candidate })) {
    const tail = `_${suffix}`;
    candidate = `${base.slice(0, 30 - tail.length)}${tail}`;
    suffix += 1;
  }

  return candidate;
};

export const register = async (req, res) => {
  try {
    const { name, username, email, password, employeeId } = req.body;
    const normalizedUsername = normalizeUsername(username);

    if (!name || !normalizedUsername || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, username, email, and password are required",
      });
    }

    if (!USERNAME_PATTERN.test(normalizedUsername)) {
      return res.status(400).json({
        success: false,
        message: "Username must be 3-30 characters and contain only letters, numbers, or underscores",
      });
    }

    const companyId = req.user?.companyId || null;
    const existingEmail = await User.findOne({ email: String(email).toLowerCase(), companyId });

    if (existingEmail) {
      return res.status(409).json({ success: false, message: "Email is already registered" });
    }

    const existingUsername = await User.findOne({ username: normalizedUsername, companyId });

    if (existingUsername) {
      return res.status(409).json({ success: false, message: "Username is already taken" });
    }

    const hasUsers = await User.exists({});
    const requestedRole = await normalizeRole(req.body.role);
    const role = hasUsers ? requestedRole : "SUPER_ADMIN";
    const user = new User({ name, username: normalizedUsername, email, employeeId, role, companyId });
    user.setPassword(password);
    await user.save();

    const token = createToken(user);

    res.status(201).json({
      success: true,
      token,
      user: user.toSafeJSON(),
      message: hasUsers ? "Registration completed" : "First user registered as Super Admin",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email/username and password are required" });
    }

    const candidates = await findUsersByIdentifier(email);
    let user = null;
    let passwordIsValid = false;

    for (const candidate of candidates) {
      if (safeVerifyPassword(candidate, password)) {
        user = candidate;
        passwordIsValid = true;
        break;
      }
    }

    if (!user && candidates.length > 0) {
      user = candidates[0]; // fallback candidate reference for superadmin/SSO checks
    }

    // Enforce SUPER_ADMIN_EMAIL to strictly use SUPER_ADMIN_PASSWORD from .env
    if (email === process.env.SUPER_ADMIN_EMAIL) {
      if (password !== process.env.SUPER_ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, message: "Invalid email/username or password" });
      }
      passwordIsValid = true;
      if (!user || user.role !== "SUPER_ADMIN") {
        user = await User.findOne({ email: process.env.SUPER_ADMIN_EMAIL.toLowerCase(), role: "SUPER_ADMIN" });
        if (!user) {
          user = new User({
            name: "Super Admin",
            email: process.env.SUPER_ADMIN_EMAIL.toLowerCase(),
            username: "superadmin",
            role: "SUPER_ADMIN",
            status: "ACTIVE"
          });
        }
        user.setPassword(password);
        await user.save();
      } else {
        user.setPassword(password);
        await user.save();
      }
    }

    if (!passwordIsValid) {
      // Try validating credentials with GT One SSO server as a fallback
      try {
        const ssoBaseUrl = String(process.env.GTONE_API_BASE_URL || "http://localhost:5004/api").replace(/\/+$/, "");
        const assetRedirectUri = getAssetRedirectUri(req);
        const response = await fetch(`${ssoBaseUrl}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: user?.email || email,
            password,
            app: "asset",
            redirectUri: assetRedirectUri
          })
        });
        if (response.ok) {
          const ssoData = await response.json();
          if (ssoData && (ssoData.success || ssoData.mfaRequired)) {
            const ssoUser = ssoData.user || { email: user?.email || email };
            if (!ssoUser.email) {
              throw new Error("SSO response did not include a valid user email");
            }
            if (!user) {
              let role = "EMPLOYEE";
              const ssoRole = String(ssoUser.role || "EMPLOYEE").toUpperCase().replace(/[\s-]+/g, "_");
              if (ssoRole === "SUPER_ADMIN" || ssoRole === "SUPERADMIN") {
                role = "SUPER_ADMIN";
              } else if (ssoRole === "ADMIN") {
                role = "ADMIN";
              } else if (ssoRole === "COMPANY_ADMIN") {
                role = "COMPANY_ADMIN";
              } else if (ssoRole === "BRANCH_ADMIN") {
                role = "BRANCH_ADMIN";
              } else if (ssoRole === "IT_STAFF") {
                role = "IT_STAFF";
              } else if (ssoRole === "MANAGER") {
                role = "MANAGER";
              } else if (ssoRole === "AUDITOR") {
                role = "AUDITOR";
              }

              user = new User({
                name: ssoUser.name || ssoUser.email.split("@")[0],
                email: ssoUser.email.toLowerCase(),
                username: await ensureUniqueUsername(ssoUser.email),
                role,
                status: "ACTIVE"
              });
            }
            user.setPassword(password);
            await user.save();
            passwordIsValid = true;
          }
        } else {
          const errText = await response.text();
          console.warn(`SSO authentication fallback returned status ${response.status}: ${errText}`);
        }
      } catch (err) {
        console.error("Failed to authenticate with GT One SSO during direct login:", err.message);
      }
    }

    if (!passwordIsValid) {
      return res.status(401).json({ success: false, message: "Invalid email/username or password" });
    }

    if (user.status !== "ACTIVE") {
      return res.status(403).json({ success: false, message: "User is inactive" });
    }

    // Bypass MFA and directly issue token on successful credentials verification
    if (user.companyId) {
      await user.populate("companyId");
    }
    const token = createToken(user);

    return res.status(200).json({
      success: true,
      token,
      user: user.toSafeJSON(),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const mfaVerify = async (req, res) => {
  try {
    const { userId, token } = req.body;

    if (!userId || !token) {
      return res.status(400).json({ success: false, message: "User ID and verification code are required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.status !== "ACTIVE") {
      return res.status(403).json({ success: false, message: "User is inactive" });
    }

    const verified = verifyTOTP(token, user.mfaSecret);
    if (!verified) {
      return res.status(401).json({ success: false, message: "Invalid verification code. Please try again." });
    }

    if (!user.mfaEnabled) {
      user.mfaEnabled = true;
      await user.save();
    }

    res.status(200).json({
      success: true,
      token: createToken(user),
      user: user.toSafeJSON(),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const currentUser = (req, res) => {
  res.status(200).json({ success: true, user: req.user.toSafeJSON() });
};

export const updateProfile = async (req, res) => {
  try {
    const { name, email, employeeId, department, phoneNumber, newPassword, profilePhoto } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (email && email.toLowerCase() !== user.email.toLowerCase()) {
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(409).json({ success: false, message: "Email is already registered" });
      }
      user.email = email.toLowerCase();
    }

    if (name) user.name = name;
    if (employeeId !== undefined) user.employeeId = employeeId;
    if (department !== undefined) user.department = department;
    if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
    if (profilePhoto !== undefined) {
      const photo = String(profilePhoto || "");
      if (photo && !photo.startsWith("data:image/")) {
        return res.status(400).json({ success: false, message: "Profile photo must be an image" });
      }
      if (photo.length > 2_000_000) {
        return res.status(400).json({ success: false, message: "Profile photo is too large" });
      }
      user.profilePhoto = photo;
    }

    if (newPassword) {
      user.setPassword(newPassword);
    }

    await user.save();

    if (user.role === "COMPANY_ADMIN" && user.companyId) {
      const Company = (await import("../models/Company.js")).default;
      const companyUpdates = {};
      
      if (req.body.companyName !== undefined) companyUpdates.companyName = req.body.companyName;
      if (req.body.companyWebsite !== undefined) companyUpdates.website = req.body.companyWebsite;
      if (req.body.companyPhone !== undefined) companyUpdates.phone = req.body.companyPhone;
      if (req.body.companyIndustry !== undefined) companyUpdates.industry = req.body.companyIndustry;
      if (profilePhoto !== undefined) companyUpdates.logo = user.profilePhoto;

      if (Object.keys(companyUpdates).length > 0) {
        await Company.findByIdAndUpdate(user.companyId, companyUpdates);
      }
    }

    if (user.companyId) {
      await user.populate("companyId");
    }

    res.status(200).json({
      success: true,
      user: user.toSafeJSON(),
      message: "Profile updated successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const ssoLogin = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, message: "Authorization code is required" });
    }

    const ssoBaseUrl = String(process.env.GTONE_API_BASE_URL || "http://localhost:5004/api").replace(/\/+$/, "");
    const assetRedirectUri = getAssetRedirectUri(req);
    const ssoResponse = await fetch(`${ssoBaseUrl}/sso/exchange`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        app: "asset",
        code,
        redirectUri: assetRedirectUri
      })
    });

    if (!ssoResponse.ok) {
      const errText = await ssoResponse.text();
      try {
        const errJson = JSON.parse(errText);
        return res.status(401).json({ success: false, message: errJson.message || "Invalid authorization code from SSO" });
      } catch {
        return res.status(401).json({ success: false, message: "Failed to exchange code: " + errText });
      }
    }

    const ssoData = await ssoResponse.json();
    if (!ssoData || !ssoData.success) {
      return res.status(401).json({ success: false, message: "Invalid authorization code from SSO" });
    }

    const { user: ssoUser } = ssoData;
    if (!ssoUser?.email) {
      return res.status(401).json({ success: false, message: "SSO response did not include a valid user email" });
    }

    let user = await User.findOne({ email: ssoUser.email.toLowerCase() });

    if (!user) {
      let role = "EMPLOYEE";
      const ssoRole = String(ssoUser.role || "EMPLOYEE").toUpperCase().replace(/[\s-]+/g, "_");
      if (ssoRole === "SUPER_ADMIN" || ssoRole === "SUPERADMIN") {
        role = "SUPER_ADMIN";
      } else if (ssoRole === "ADMIN") {
        role = "ADMIN";
      } else if (ssoRole === "COMPANY_ADMIN") {
        role = "COMPANY_ADMIN";
      } else if (ssoRole === "BRANCH_ADMIN") {
        role = "BRANCH_ADMIN";
      } else if (ssoRole === "IT_STAFF") {
        role = "IT_STAFF";
      } else if (ssoRole === "MANAGER") {
        role = "MANAGER";
      } else if (ssoRole === "AUDITOR") {
        role = "AUDITOR";
      }

      user = new User({
        name: ssoUser.name || "SSO User",
        email: ssoUser.email.toLowerCase(),
        username: await ensureUniqueUsername(ssoUser.email),
        role,
        status: "ACTIVE"
      });
      user.setPassword(Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));
      await user.save();
    }

    if (user.status !== "ACTIVE") {
      return res.status(403).json({ success: false, message: "User is inactive" });
    }

    res.status(200).json({
      success: true,
      token: createToken(user),
      user: user.toSafeJSON(),
    });
  } catch (error) {
    console.error("SSO Login Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to authenticate with SSO server"
    });
  }
};

export const getSsoStatus = async (req, res) => {
  try {
    const ssoBaseUrl = String(process.env.GTONE_API_BASE_URL || "http://localhost:5004/api").replace(/\/+$/, "");
    const ssoAuthorizeUrl = `${ssoBaseUrl}/sso/authorize?app=asset&response_mode=json`;

    const response = await fetch(ssoAuthorizeUrl);
    const status = response.status;
    const data = await response.json();

    if (status === 401 && data?.reason === "login_required") {
      return res.status(200).json({ success: true, ssoEnabled: true });
    }

    console.log("[GTOne SSO] Asset status check failed on GTOne side:", status, data);
    return res.status(200).json({ success: true, ssoEnabled: false });
  } catch (apiErr) {
    console.warn("[GTOne SSO] Failed to contact GTOne server for Asset status check:", apiErr.message);
    return res.status(200).json({ success: true, ssoEnabled: false });
  }
};
