import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/config/database";
import UserRequirement from "@/models/Userrequirement";
import { auth } from "@/lib/middlewares/auth";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await context.params;

    const requirement = await UserRequirement.findById(id).populate(
      "user",
      "fullName avatar"
    );

    if (!requirement) {
      return NextResponse.json(
        { success: false, message: "Requirement not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      requirement,
    });
  } catch (error) {
    console.error("GET /requirements/[id] ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}

export const PUT = auth(async (
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  try {
    await dbConnect();
    const userId = (req as any).user.id;
    const { id } = await context.params;

    const updated = await UserRequirement.findOneAndUpdate(
      { _id: id, user: userId },
      { status: "closed" },
      { new: true }
    );

    return NextResponse.json({ success: true, updated });
  } catch {
    return NextResponse.json(
      { success: false, message: "Update failed" },
      { status: 500 }
    );
  }
});
