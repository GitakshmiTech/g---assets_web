import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

async function migrateIndexes() {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log("Connected to MongoDB.");

    const User = mongoose.model("User", new mongoose.Schema({}, { strict: false }));

    // Unset null or empty string username and employeeId from existing documents
    await User.updateMany(
      { $or: [{ username: null }, { username: "" }] },
      { $unset: { username: "" } }
    );
    await User.updateMany(
      { $or: [{ employeeId: null }, { employeeId: "" }] },
      { $unset: { employeeId: "" } }
    );
    console.log("Unset null/empty username and employeeId fields from existing user records.");

    // Drop old indexes if present
    const existingIndexes = await User.collection.indexes();
    const indexNames = existingIndexes.map((idx) => idx.name);

    if (indexNames.includes("email_1")) {
      try {
        await User.collection.dropIndex("email_1");
        console.log("Dropped email_1 index");
      } catch (e) {
        console.log("email_1 drop:", e.message);
      }
    }

    if (indexNames.includes("username_1")) {
      try {
        await User.collection.dropIndex("username_1");
        console.log("Dropped username_1 index");
      } catch (e) {
        console.log("username_1 drop:", e.message);
      }
    }

    if (indexNames.includes("username_1_companyId_1")) {
      try {
        await User.collection.dropIndex("username_1_companyId_1");
        console.log("Dropped old username_1_companyId_1 index");
      } catch (e) {
        console.log("username_1_companyId_1 drop:", e.message);
      }
    }

    if (indexNames.includes("employeeId_1_companyId_1")) {
      try {
        await User.collection.dropIndex("employeeId_1_companyId_1");
        console.log("Dropped old employeeId_1_companyId_1 index");
      } catch (e) {
        console.log("employeeId_1_companyId_1 drop:", e.message);
      }
    }

    // Create compound multi-tenant index on (email, companyId)
    try {
      await User.collection.createIndex({ email: 1, companyId: 1 }, { unique: true });
      console.log("Created email_1_companyId_1 unique index");
    } catch (e) {
      console.log("Error creating email_1_companyId_1:", e.message);
    }

    // Create partial compound index for username
    try {
      await User.collection.createIndex(
        { username: 1, companyId: 1 },
        {
          unique: true,
          partialFilterExpression: { username: { $type: "string", $gt: "" } },
        }
      );
      console.log("Created username_1_companyId_1 partial unique index");
    } catch (e) {
      console.log("Error creating username_1_companyId_1:", e.message);
    }

    // Create partial compound index for employeeId
    try {
      await User.collection.createIndex(
        { employeeId: 1, companyId: 1 },
        {
          unique: true,
          partialFilterExpression: { employeeId: { $type: "string", $gt: "" } },
        }
      );
      console.log("Created employeeId_1_companyId_1 partial unique index");
    } catch (e) {
      console.log("Error creating employeeId_1_companyId_1:", e.message);
    }

    const indexes = await User.collection.indexes();
    console.log("MIGRATED USER INDEXES:", JSON.stringify(indexes, null, 2));

    process.exit(0);
  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  }
}

migrateIndexes();
