//app/api/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/config/database";
import { auth } from "@/lib/middlewares/auth";
import User from "@/models/User";
import Profile from "@/models/Profile";

const normalizePhoneDigits = (value: string) => value.replace(/\D/g, "");

const normalizeIndianPhone = (value: string) => {
  const digits = normalizePhoneDigits(value);
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  return digits;
};

const isDummyIndianPhone = (phone: string) => {
  if (/^(\d)\1{9}$/.test(phone)) return true;

  let ascending = true;
  let descending = true;

  for (let i = 1; i < phone.length; i++) {
    const prev = Number(phone[i - 1]);
    const curr = Number(phone[i]);

    if (curr !== (prev + 1) % 10) ascending = false;
    if (curr !== (prev + 9) % 10) descending = false;
  }

  return ascending || descending;
};

const isValidIndianPhone = (value: string) => {
  const normalized = normalizeIndianPhone(value);
  return /^[6-9]\d{9}$/.test(normalized) && !isDummyIndianPhone(normalized);
};

export const GET = auth(async (req: NextRequest) => {
  await dbConnect();
  const userId = (req as any).user.id;
  const user = await User.findById(userId)
    .select("-password")
    .populate("additionalDetails")
    .lean();
  if (!user) return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
  return NextResponse.json({ success: true, user });
});

export const PUT = auth(async (req: NextRequest) => {
  await dbConnect();
  const userId = (req as any).user.id;
  const body = await req.json();

  const incomingContactNumber = body.contactNumber;
  if (typeof incomingContactNumber === "string" && incomingContactNumber.trim()) {
    if (!isValidIndianPhone(incomingContactNumber)) {
      return NextResponse.json(
        { success: false, message: "Please enter a valid Indian mobile number" },
        { status: 400 }
      );
    }

    body.contactNumber = normalizeIndianPhone(incomingContactNumber);
  }

  const user = await User.findById(userId).populate("additionalDetails");
  if (!user)
    return NextResponse.json(
      { success: false, message: "User not found" },
      { status: 404 }
    );

  // ✅ Extract additionalDetails from body
  const profileData = body.additionalDetails;
  delete body.additionalDetails;

  // ✅ Update USER fields (name, phone, etc.)
  Object.assign(user, body);

  // ✅ Update or create PROFILE
  if (profileData) {
    if (user.additionalDetails) {
      // ✅ Update existing profile
      await Profile.findByIdAndUpdate(
        user.additionalDetails._id,
        profileData,
        { new: true }
      );
    } else {
      // ✅ Create new profile & attach to user
      const newProfile = await Profile.create(profileData);
      user.additionalDetails = newProfile._id;
    }
  }

  await user.save();

  return NextResponse.json({
    success: true,
    message: "Profile updated",
  });
});


export const DELETE = auth(async (req: NextRequest) => {
  await dbConnect();
  const userId = (req as any).user.id;
  const user = await User.findById(userId).populate("additionalDetails");
  if (!user) return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
  if (user.additionalDetails) await Profile.findByIdAndDelete((user.additionalDetails as any)._id);
  await User.findByIdAndDelete(userId);
  const res = NextResponse.json({ success: true, message: "Account deleted" });
  res.cookies.delete("token");
  return res;
});