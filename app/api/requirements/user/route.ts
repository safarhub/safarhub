import { NextResponse } from "next/server";
import dbConnect from "@/lib/config/database";
import UserRequirement from "@/models/Userrequirement";
import { auth } from "@/lib/middlewares/auth";

export const GET = auth(async (req: Request) => {
  try {
    await dbConnect();

    const user = (req as any).user;
    if (!user || !user.id) {
      return NextResponse.json(
        { success: false, message: "User not authenticated" },
        { status: 401 }
      );
    }

    const requirements = await UserRequirement.find({ user: user.id })
      .sort({ createdAt: -1 })
      .populate("user", "fullName email avatar");

    return NextResponse.json({
      success: true,
      requirements,
    });
  } catch (error) {
    console.error("GET /requirements/user ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
});
