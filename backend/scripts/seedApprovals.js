import "dotenv/config";
import mongoose from "mongoose";
import Asset from "../models/Asset.js";
import { ensureDefaultRoles } from "../models/Role.js";

const requestsToSeed = [
  // Req-135
  {
    recordType: "REQUEST",
    requestId: "Req-135",
    requestedBy: "Albert Admin",
    brand: "Apple",
    category: "iPhone",
    subCategory: "iPhone",
    quantity: 1,
    assetName: "Apple iPhone",
    requestType: "Procurement",
    requestDate: new Date("2026-05-18"),
    requestPriority: "Medium",
    requestReason: "Needed for development testing",
    requestStatus: "Pending",
    managerApproval: "Pending",
    adminApproval: "Pending",
  },
  // Req-131 (Multi-product request, split into 3 records)
  {
    recordType: "REQUEST",
    requestId: "Req-131",
    requestedBy: "Albert Admin",
    brand: "CISCO",
    category: "The Arburg Allrounder 370",
    subCategory: "The Arburg Allrounder 370",
    quantity: 1,
    assetName: "CISCO Switch / Equipment",
    requestType: "Procurement",
    requestDate: new Date("2026-05-12"),
    requestPriority: "Medium",
    requestReason: "Infrastructure upgrade",
    requestStatus: "Pending",
    managerApproval: "Pending",
    adminApproval: "Pending",
  },
  {
    recordType: "REQUEST",
    requestId: "Req-131",
    requestedBy: "Albert Admin",
    brand: "Apple",
    category: "iPhone",
    subCategory: "iPhone",
    quantity: 5,
    assetName: "Apple iPhone 5 Units",
    requestType: "Procurement",
    requestDate: new Date("2026-05-12"),
    requestPriority: "Medium",
    requestReason: "Team expansion",
    requestStatus: "Pending",
    managerApproval: "Pending",
    adminApproval: "Pending",
  },
  {
    recordType: "REQUEST",
    requestId: "Req-131",
    requestedBy: "Albert Admin",
    brand: "Samsung",
    category: "Galaxy",
    subCategory: "Galaxy",
    quantity: 1,
    assetName: "Samsung Galaxy Phone",
    requestType: "Procurement",
    requestDate: new Date("2026-05-12"),
    requestPriority: "Medium",
    requestReason: "QA testing",
    requestStatus: "Pending",
    managerApproval: "Pending",
    adminApproval: "Pending",
  },
  // Req-134
  {
    recordType: "REQUEST",
    requestId: "Req-134",
    requestedBy: "Albert Admin",
    brand: "Apple",
    category: "iPhone",
    subCategory: "iPhone",
    quantity: 1,
    assetName: "Apple iPhone Single Unit",
    requestType: "Procurement",
    requestDate: new Date("2026-05-14"),
    requestPriority: "Medium",
    requestReason: "Replacement device",
    requestStatus: "Pending",
    managerApproval: "Pending",
    adminApproval: "Pending",
  },
  // Req-133
  {
    recordType: "REQUEST",
    requestId: "Req-133",
    requestedBy: "Albert Admin",
    brand: "Apple",
    category: "iPhone",
    subCategory: "iPhone",
    quantity: 1,
    assetName: "Apple iPhone Developer",
    requestType: "Procurement",
    requestDate: new Date("2026-05-13"),
    requestPriority: "Medium",
    requestReason: "Design review",
    requestStatus: "Pending",
    managerApproval: "Pending",
    adminApproval: "Pending",
  },
  // Req-132
  {
    recordType: "REQUEST",
    requestId: "Req-132",
    requestedBy: "Albert Admin",
    brand: "Dell",
    category: "Inspiron",
    subCategory: "Inspiron",
    quantity: 1,
    assetName: "Dell Inspiron Laptop",
    requestType: "Procurement",
    requestDate: new Date("2026-05-13"),
    requestPriority: "Medium",
    requestReason: "Office usage",
    requestStatus: "Pending",
    managerApproval: "Pending",
    adminApproval: "Pending",
  },
  // Req-128 (Multi-product request)
  {
    recordType: "REQUEST",
    requestId: "Req-128",
    requestedBy: "Albert Admin",
    brand: "Apple",
    category: "iPhone",
    subCategory: "iPhone",
    quantity: 1,
    assetName: "Apple iPhone Core",
    requestType: "Procurement",
    requestDate: new Date("2026-05-06"),
    requestPriority: "Medium",
    requestReason: "Executive support",
    requestStatus: "Pending",
    managerApproval: "Pending",
    adminApproval: "Pending",
  },
  {
    recordType: "REQUEST",
    requestId: "Req-128",
    requestedBy: "Albert Admin",
    brand: "Timex",
    category: "Mooring",
    subCategory: "Mooring",
    quantity: 1,
    assetName: "Timex Smartwatch",
    requestType: "Procurement",
    requestDate: new Date("2026-05-06"),
    requestPriority: "Medium",
    requestReason: "Hardware research",
    requestStatus: "Pending",
    managerApproval: "Pending",
    adminApproval: "Pending",
  },
  // Req-127
  {
    recordType: "REQUEST",
    requestId: "Req-127",
    requestedBy: "Albert Admin",
    brand: "Apple",
    category: "iPhone",
    subCategory: "iPhone",
    quantity: 1,
    assetName: "Apple iPhone 127",
    requestType: "Procurement",
    requestDate: new Date("2026-04-29"),
    requestPriority: "Medium",
    requestReason: "Testing",
    requestStatus: "Pending",
    managerApproval: "Pending",
    adminApproval: "Pending",
  },
  // Req-124 (Approved)
  {
    recordType: "REQUEST",
    requestId: "Req-124",
    requestedBy: "Albert Admin",
    brand: "CISCO",
    category: "CISCO",
    subCategory: "CISCO",
    quantity: 1,
    assetName: "CISCO Networking Core",
    requestType: "Procurement",
    requestDate: new Date("2026-04-23"),
    requestPriority: "Medium",
    requestReason: "HQ Router Replacement",
    requestStatus: "Approved",
    managerApproval: "Approved",
    adminApproval: "Approved",
  },
  // Req-123
  {
    recordType: "REQUEST",
    requestId: "Req-123",
    requestedBy: "Albert Admin",
    brand: "Samsung",
    category: "Galaxy",
    subCategory: "Galaxy",
    quantity: 1,
    assetName: "Samsung Galaxy Test",
    requestType: "Procurement",
    requestDate: new Date("2026-04-22"),
    requestPriority: "Medium",
    requestReason: "App check",
    requestStatus: "Pending",
    managerApproval: "Pending",
    adminApproval: "Pending",
  },
  // Req-121 (Approved)
  {
    recordType: "REQUEST",
    requestId: "Req-121",
    requestedBy: "Albert Admin",
    brand: "Apple",
    category: "iPhone",
    subCategory: "iPhone",
    quantity: 1,
    assetName: "Apple iPhone Sales Team",
    requestType: "Procurement",
    requestDate: new Date("2026-04-21"),
    requestPriority: "Medium",
    requestReason: "Sales executive onboarding",
    requestStatus: "Approved",
    managerApproval: "Approved",
    adminApproval: "Approved",
  },
  // Req-120 (Approved Multi-product request)
  {
    recordType: "REQUEST",
    requestId: "Req-120",
    requestedBy: "Albert Admin",
    brand: "Samsung",
    category: "Galaxy",
    subCategory: "Galaxy",
    quantity: 1,
    assetName: "Samsung Galaxy S23",
    requestType: "Procurement",
    requestDate: new Date("2026-04-16"),
    requestPriority: "Medium",
    requestReason: "Executive migration",
    requestStatus: "Approved",
    managerApproval: "Approved",
    adminApproval: "Approved",
  },
  {
    recordType: "REQUEST",
    requestId: "Req-120",
    requestedBy: "Albert Admin",
    brand: "Dell",
    category: "Inspiron",
    subCategory: "Inspiron",
    quantity: 1,
    assetName: "Dell Inspiron Developer",
    requestType: "Procurement",
    requestDate: new Date("2026-04-16"),
    requestPriority: "Medium",
    requestReason: "Developer migration",
    requestStatus: "Approved",
    managerApproval: "Approved",
    adminApproval: "Approved",
  },
  {
    recordType: "REQUEST",
    requestId: "Req-120",
    requestedBy: "Albert Admin",
    brand: "CISCO",
    category: "The Arburg Allrounder 370",
    subCategory: "The Arburg Allrounder 370",
    quantity: 1,
    assetName: "CISCO Switch Industrial",
    requestType: "Procurement",
    requestDate: new Date("2026-04-16"),
    requestPriority: "Medium",
    requestReason: "Factory network deployment",
    requestStatus: "Approved",
    managerApproval: "Approved",
    adminApproval: "Approved",
  },
];

const seedApprovals = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log("Connected to MongoDB database.");

    // Sync system roles so permissions and sidebars are up to date in DB
    console.log("Ensuring roles and sidebars are fully synchronized...");
    await ensureDefaultRoles();
    console.log("Roles synchronized.");

    // Delete existing request records so we have a clean slate matching the screenshot
    console.log("Removing existing Asset request records...");
    await Asset.deleteMany({ recordType: "REQUEST" });
    console.log("Cleaned request records.");

    // Insert requests
    const seededRequests = await Asset.insertMany(requestsToSeed);
    console.log(`Successfully seeded ${seededRequests.length} request records.`);

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding approvals data:", error);
    process.exit(1);
  }
};

seedApprovals();
