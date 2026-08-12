import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

async function migrateIndexes() {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log("Connected to MongoDB.");

    const User = mongoose.model("User", new mongoose.Schema({}, { strict: false }));

    // Drop old single-field global indexes if present
    try {
      await User.collection.dropIndex("email_1");
      console.log("Dropped email_1 index");
    } catch (e) {
      console.log("email_1 index:", e.message);
    }

    try {
      await User.collection.dropIndex("username_1");
      console.log("Dropped username_1 index");
    } catch (e) {
      console.log("username_1 index:", e.message);
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
          partialFilterExpression: { username: { $type: "string" } },
        }
      );
      console.log("Created username_1_companyId_1 partial unique index");
    } catch (e) {
      console.log("Error creating username_1_companyId_1:", e.message);
    }

    // Clean up duplicate employeeId on superadmin test records if needed
    await User.updateOne({ email: "superadmin@gmail.com", employeeId: "001" }, { $set: { employeeId: "SA-002" } });
    await User.updateOne({ email: "admin@gmail.com", employeeId: "001" }, { $set: { employeeId: "SA-001" } });

    // Create partial compound index for employeeId
    try {
      await User.collection.createIndex(
        { employeeId: 1, companyId: 1 },
        {
          unique: true,
          partialFilterExpression: { employeeId: { $type: "string" } },
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
