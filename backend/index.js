import express from "express";
import mongoose from "mongoose";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import route from "./routes/assetRoutes.js";
import { ensureDefaultRoles } from "./models/Role.js";
import User from "./models/User.js";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));
// app.use(cors());
app.use(
  cors({
    origin: "*",
  }),
);

app.use("/api", route);

// Serve static files from the frontend dist directory
app.use(express.static(path.join(__dirname, "../asset-management/dist")));

// Fallback all non-API routes to index.html for SPA support
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "../asset-management/dist/index.html"));
});

const PORT = process.env.PORT || 7001;
const MONGO_URL = process.env.MONGO_URL;
const DEFAULT_SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || "superadmin@example.com";
const DEFAULT_SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || "SuperAdminSecure2026!";

const ensureDefaultSuperAdmin = async () => {
  const email = DEFAULT_SUPER_ADMIN_EMAIL.toLowerCase();
  const baseUsername = DEFAULT_SUPER_ADMIN_EMAIL.split("@")[0] || "superadmin";
  let user = await User.findOne({ email });

  if (!user) {
    let username = baseUsername;
    const usernameOwner = await User.findOne({ username });
    if (usernameOwner) {
      username = `${baseUsername}_super_admin`;
    }
    const fallbackOwner = await User.findOne({ username });
    if (fallbackOwner) {
      username = `${baseUsername}_${Date.now()}`;
    }

    user = new User({
      name: "Super Admin",
      username,
      email,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    });
  }

  user.role = "SUPER_ADMIN";
  user.status = "ACTIVE";
  user.setPassword(DEFAULT_SUPER_ADMIN_PASSWORD);
  await user.save();
};

import { spawn } from 'child_process';
import fs from 'fs';

const startLocalMongo = () => {
  return new Promise((resolve) => {
    const mongodPath = "C:\\Program Files\\MongoDB\\Server\\8.3\\bin\\mongod.exe";
    const dbPath = path.join(__dirname, "mongodb_data");

    if (fs.existsSync(mongodPath)) {
      console.log("Auto-starting local MongoDB service...");
      try {
        const mongoProcess = spawn(mongodPath, [
          "--dbpath", dbPath,
          "--port", "27017",
          "--bind_ip", "127.0.0.1"
        ], {
          detached: true,
          stdio: 'ignore'
        });
        mongoProcess.unref();
      } catch (err) {
        console.warn("Failed to spawn mongod process:", err.message);
      }
      setTimeout(resolve, 3000);
    } else {
      resolve();
    }
  });
};

const startServer = async () => {
  const isLocal = MONGO_URL.includes('127.0.0.1') || MONGO_URL.includes('localhost');
  if (isLocal) {
    await startLocalMongo();
  }

  mongoose
    .connect(MONGO_URL)
    .then(async () => {
      console.log("Database connected successfully!");
      await ensureDefaultRoles();
      await ensureDefaultSuperAdmin();
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server is running on port: ${PORT}`);
      });
    })
    .catch((error) => {
      console.error("Database connection failed:", error.message);
    });
};

startServer();
