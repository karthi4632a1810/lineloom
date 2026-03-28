import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { env } from "../config/env.js";
import { ApiError } from "../utils/apiError.js";

const sanitizeUser = (user = null) => ({
  id: user?._id?.toString() ?? "",
  name: user?.name ?? "",
  email: user?.email ?? "",
  role: user?.role ?? "nurse"
});

const signToken = (user = null) =>
  jwt.sign(
    {
      sub: user?._id?.toString() ?? "",
      role: user?.role ?? "nurse",
      email: user?.email ?? ""
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );

export const registerUser = async (input = {}) => {
  const name = String(input?.name ?? "").trim();
  const email = String(input?.email ?? "").trim().toLowerCase();
  const password = String(input?.password ?? "");
  const role = String(input?.role ?? "nurse");

  if (!name || !email || !password) {
    throw new ApiError("name, email and password are required", 400);
  }
  const existing = await User.findOne({ email }).lean();
  if (existing) {
    throw new ApiError("Email already exists", 409);
  }
  const password_hash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, password_hash, role });
  return {
    user: sanitizeUser(user),
    token: signToken(user)
  };
};

export const loginUser = async (input = {}) => {
  const email = String(input?.email ?? "").trim().toLowerCase();
  const password = String(input?.password ?? "");
  if (!email || !password) {
    throw new ApiError("email and password are required", 400);
  }
  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError("Invalid credentials", 401);
  }
  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    throw new ApiError("Invalid credentials", 401);
  }
  return {
    user: sanitizeUser(user),
    token: signToken(user)
  };
};
