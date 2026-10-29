import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, "Username must be at least 3 characters"],
    },
    email: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      default: "",
      trim: true,
    },
    passwordHash: {
      type: String,
      required: [true, "Password hash is required"],
    },
    passwordSalt: {
      type: String,
      required: [true, "Password salt is required"],
    },
    role: {
      type: String,
      enum: {
        values: ["admin", "user"],
        message: "Role must be either 'admin' or 'user'",
      },
      default: "user",
      required: true,
    },
    createdBy: {
      type: String,
      default: "admin",
    },
  },
  {
    timestamps: true,
  }
);

// Method to return safe user object (excluding hash/salt)
userSchema.methods.toSafeObject = function () {
  return {
    id: this._id.toString(),
    _id: this._id.toString(),
    username: this.username,
    email: this.email,
    name: this.name,
    role: this.role,
    createdBy: this.createdBy,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;
