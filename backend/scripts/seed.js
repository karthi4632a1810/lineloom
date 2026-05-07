/**
 * Purpose: Seed local MongoDB with auth users and sample tracker records.
 */
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { connectMongo } from "../config/mongo.js";
import { User } from "../models/User.js";
import { Token } from "../models/Token.js";
import { TimeTracking } from "../models/TimeTracking.js";
import { DepartmentFlow } from "../models/DepartmentFlow.js";

dotenv.config();

const DEFAULT_PASSWORD = "Pass@123";
const NOW = new Date();

const users = [
  { name: "System Admin", email: "admin@hospital.local", role: "admin" },
  { name: "Frontdesk Nurse", email: "nurse@hospital.local", role: "nurse" },
  { name: "Duty Doctor", email: "doctor@hospital.local", role: "doctor" }
];

const makeDate = (minutesAgo = 0) => {
  const date = new Date(NOW);
  date.setMinutes(date.getMinutes() - minutesAgo);
  return date;
};

const tokenSeeds = [
  {
    token_id: "T-SEED-001",
    patient_id: "1001",
    visit_id: "5001",
    department: "General Medicine",
    parent_token_id: null,
    status: "COMPLETED",
    department_queue_no: 1,
    created_at: makeDate(140),
    tracking: {
      waiting_start: makeDate(138),
      consult_start: makeDate(120),
      consult_end: makeDate(108),
      care_start: makeDate(104),
      care_end: makeDate(95),
      break_start: null,
      break_end: null
    }
  },
  {
    token_id: "T-SEED-002",
    patient_id: "1002",
    visit_id: "5002",
    department: "ENT",
    parent_token_id: null,
    status: "CONSULTING",
    department_queue_no: 1,
    created_at: makeDate(72),
    tracking: {
      waiting_start: makeDate(70),
      consult_start: makeDate(45),
      consult_end: null,
      care_start: null,
      care_end: null,
      break_start: null,
      break_end: null
    }
  },
  {
    token_id: "T-SEED-003",
    patient_id: "1003",
    visit_id: "5003",
    department: "Cardiology",
    parent_token_id: "T-SEED-004",
    status: "WAITING",
    department_queue_no: 1,
    created_at: makeDate(38),
    tracking: {
      waiting_start: makeDate(36),
      consult_start: null,
      consult_end: null,
      care_start: null,
      care_end: null,
      break_start: null,
      break_end: makeDate(36)
    }
  },
  {
    token_id: "T-SEED-004",
    patient_id: "1003",
    visit_id: "5003",
    department: "Emergency",
    parent_token_id: null,
    status: "CONSULTING",
    department_queue_no: 1,
    created_at: makeDate(60),
    tracking: {
      waiting_start: makeDate(58),
      consult_start: makeDate(55),
      consult_end: makeDate(40),
      care_start: null,
      care_end: null,
      break_start: makeDate(38),
      break_end: null
    }
  },
  {
    token_id: "T-SFD-001",
    patient_id: "1004",
    visit_id: "5004",
    department: "General Medicine",
    parent_token_id: null,
    status: "CONSULTING",
    department_queue_no: 1,
    created_at: makeDate(25),
    tracking: {
      waiting_start: makeDate(24),
      consult_start: makeDate(12),
      consult_end: null,
      care_start: null,
      care_end: null,
      break_start: null,
      break_end: null,
      consult_note: ""
    }
  }
];

const flowSeeds = [
  {
    source_token_id: "T-SEED-004",
    destination_token_id: "T-SEED-003",
    from_department: "Emergency",
    to_department: "Cardiology"
  }
];

const seedUsers = async () => {
  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  for (const user of users) {
    await User.updateOne(
      { email: user.email },
      {
        $set: {
          name: user.name,
          role: user.role,
          password_hash: hash
        }
      },
      { upsert: true }
    );
  }
};

const seedTokens = async () => {
  for (const item of tokenSeeds) {
    await Token.updateOne(
      { token_id: item.token_id },
      {
        $set: {
          patient_id: item.patient_id,
          visit_id: item.visit_id,
          department: item.department,
          parent_token_id: item.parent_token_id,
          status: item.status,
          created_at: item.created_at,
          department_queue_no: item.department_queue_no
        }
      },
      { upsert: true }
    );
    await TimeTracking.updateOne(
      { token_id: item.token_id },
      {
        $set: {
          token_id: item.token_id,
          ...item.tracking
        }
      },
      { upsert: true }
    );
  }
};

const seedFlows = async () => {
  for (const flow of flowSeeds) {
    await DepartmentFlow.updateOne(
      {
        source_token_id: flow.source_token_id,
        destination_token_id: flow.destination_token_id
      },
      { $set: flow },
      { upsert: true }
    );
  }
};

const runSeed = async () => {
  try {
    await connectMongo();
    await seedUsers();
    await seedTokens();
    await seedFlows();
    process.stdout.write("Seed completed successfully.\n");
    process.stdout.write("Login users: admin, nurse, doctor seeded.\n");
    process.stdout.write(`Password for all users: ${DEFAULT_PASSWORD}\n`);
    process.exit(0);
  } catch (error) {
    process.stderr.write(
      `Seed failed: ${error?.message ?? "Unknown seed error"}\n`
    );
    process.exit(1);
  }
};

runSeed();
