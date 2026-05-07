import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { otpStore } from "@/lib/otpStore";

// ---- Replace this import with your actual DB/model ----
// Example using Mongoose:  import Admin from "@/models/Admin";
// Example using Prisma:    import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    // 1. Verify admin session
    const cookie = req.headers.get("cookie") || "";
    const verifyRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/verify`, {
      headers: { cookie },
    });
    if (!verifyRes.ok) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    const { user } = await verifyRes.json();
    if (!user || user.accountType !== "admin") {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    // 2. Parse request body
    const body = await req.json().catch(() => null);
    const { otp, newPassword } = body ?? {};

    if (!otp || !newPassword) {
      return NextResponse.json(
        { success: false, message: "OTP and new password are required." },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, message: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    // 3. Validate OTP
    const stored = otpStore.get("admin_otp");
    if (!stored) {
      return NextResponse.json(
        { success: false, message: "No OTP found. Please request a new one." },
        { status: 400 }
      );
    }
    if (Date.now() > stored.expiresAt) {
      otpStore.delete("admin_otp");
      return NextResponse.json(
        { success: false, message: "OTP has expired. Please request a new one." },
        { status: 400 }
      );
    }
    if (stored.otp !== otp) {
      return NextResponse.json(
        { success: false, message: "Invalid OTP. Please try again." },
        { status: 400 }
      );
    }

    // 4. OTP is valid — hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // ---- UPDATE PASSWORD IN YOUR DATABASE ----
    // The implementation below depends on your ORM/DB.
    // Uncomment and adapt the block that matches your setup:

    // ── Mongoose ──────────────────────────────────────────────────────────
    // import Admin from "@/models/Admin";
    // import { connectDB } from "@/lib/db";
    // await connectDB();
    // await Admin.findOneAndUpdate(
    //   { email: user.email },
    //   { $set: { password: hashedPassword } }
    // );

    // ── Prisma ────────────────────────────────────────────────────────────
    // import { prisma } from "@/lib/prisma";
    // await prisma.admin.update({
    //   where: { email: user.email },
    //   data: { password: hashedPassword },
    // });

    // ── Raw SQL (e.g. pg / mysql2) ────────────────────────────────────────
    // await db.query("UPDATE admins SET password = $1 WHERE email = $2", [hashedPassword, user.email]);

    // 5. Invalidate OTP after successful use
    otpStore.delete("admin_otp");

    return NextResponse.json({ success: true, message: "Password changed successfully." });
  } catch (err) {
    console.error("[change-password] error:", err);
    return NextResponse.json(
      { success: false, message: "Server error. Please try again." },
      { status: 500 }
    );
  }
}
