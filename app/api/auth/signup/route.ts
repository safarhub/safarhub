// app/api/auth/signup/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/config/database";
import User from "@/models/User";
import Profile from "@/models/Profile";
import OTP from "@/models/OTP";
import { mailSender } from "@/lib/utils/mailSender";
import welcomeUserTemplate from "@/lib/mail/templates/welcomeUserTemplate";
import newUserAdminNotification from "@/lib/mail/templates/newUserAdminNotification";
import vendorPendingTemplate from "@/lib/mail/templates/vendorPendingTemplate";
import adminVendorNotification from "@/lib/mail/templates/adminVendorNotification";
import { verifyRecaptcha } from "@/lib/utils/recaptcha";

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

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const body = await req.json();

    const {
      fullName,
      email,
      age,
      password,
      confirmPassword,
      contactNumber,
      accountType,
      otp,
      vendorServices,
      isSeller = false,
      acceptedTerms,
      recaptchaToken,
    } = body;

    const forwardedFor = req.headers.get("x-forwarded-for");
    const remoteIp = forwardedFor?.split(",")[0]?.trim();
    const recaptchaCheck = await verifyRecaptcha({
      token: recaptchaToken,
      expectedAction: "signup_submit",
      remoteIp,
    });

    if (!recaptchaCheck.success) {
      return NextResponse.json(
        {
          success: false,
          message: recaptchaCheck.message || "reCAPTCHA verification failed",
        },
        { status: 403 }
      );
    }

    if (
      !fullName ||
      !email ||
      !age ||
      !password ||
      !confirmPassword ||
      !contactNumber ||
      !otp
    ) {
      return NextResponse.json(
        { success: false, message: "All fields required" },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { success: false, message: "Passwords do not match" },
        { status: 400 }
      );
    }

    if (acceptedTerms !== true) {
      return NextResponse.json(
        { success: false, message: "Please accept the User Agreement to continue" },
        { status: 400 }
      );
    }

    if (!isValidIndianPhone(contactNumber)) {
      return NextResponse.json(
        { success: false, message: "Please enter a valid Indian mobile number" },
        { status: 400 }
      );
    }

    const normalizedContactNumber = normalizeIndianPhone(contactNumber);

    const otpRecord = await OTP.findOne({ email }).sort({ createdAt: -1 });
    if (!otpRecord || otpRecord.otp !== otp) {
      return NextResponse.json(
        { success: false, message: "Invalid OTP" },
        { status: 400 }
      );
    }

    if (await User.findOne({ email })) {
      return NextResponse.json(
        { success: false, message: "User already exists" },
        { status: 400 }
      );
    }

    const sellerSelected = Boolean(isSeller);
    const normalizedAccountType =
      sellerSelected || accountType === "vendor" ? "vendor" : "user";
    const normalizedVendorServices =
      normalizedAccountType === "vendor" ? vendorServices || [] : [];

    const profile = await Profile.create({});

    const userDoc = await User.create({
      fullName,
      email,
      age: Number(age),
      password,
      contactNumber: normalizedContactNumber,
      accountType: normalizedAccountType,
      additionalDetails: profile._id,
      vendorServices: normalizedVendorServices,
      isVendorApproved: false, // default locked until admin approves
      isSeller: sellerSelected,
      acceptedTerms: true,
      acceptedTermsAt: new Date(),
    });

    // Return a normalized user object (no password)
    const user = {
      _id: userDoc._id,
      fullName: userDoc.fullName,
      email: userDoc.email,
      contactNumber: userDoc.contactNumber,
      accountType: userDoc.accountType,
      vendorServices: userDoc.vendorServices,
      isVendorApproved: userDoc.isVendorApproved,
      isSeller: userDoc.isSeller,
      createdAt: userDoc.createdAt,
    };

    const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
    const emailTasks: Promise<unknown>[] = [];

    if (normalizedAccountType === "vendor") {
      emailTasks.push(
        mailSender(
          user.email,
          "SafarHub vendor application received",
          vendorPendingTemplate({ fullName: user.fullName })
        )
      );

      if (ADMIN_EMAIL) {
        emailTasks.push(
          mailSender(
            ADMIN_EMAIL,
            "New vendor applied on SafarHub",
            adminVendorNotification({
              fullName: user.fullName,
              email: user.email,
              contactNumber: user.contactNumber,
              age: Number(age),
              vendorServices: normalizedVendorServices,
            })
          )
        );
      }
    } else {
      emailTasks.push(
        mailSender(
          user.email,
          "Welcome to SafarHub",
          welcomeUserTemplate({ fullName: user.fullName })
        )
      );

      if (ADMIN_EMAIL) {
        emailTasks.push(
          mailSender(
            ADMIN_EMAIL,
            "New user joined SafarHub",
            newUserAdminNotification({
              fullName: user.fullName,
              email: user.email,
              contactNumber: user.contactNumber,
              age: Number(age),
              accountType: user.accountType,
              vendorServices: normalizedVendorServices,
            })
          )
        );
      }
    }

    await Promise.allSettled(emailTasks);

    return NextResponse.json({
      success: true,
      message: "Signup successful",
      user,
    });
  } catch (error: any) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}
