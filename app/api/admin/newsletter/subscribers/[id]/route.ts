import { NextRequest, NextResponse } from "next/server";
import Newsletter from "@/models/Newsletter";
import dbConnect from "@/lib/config/database";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();

    const { id } = await params;

    const result = await Newsletter.findByIdAndDelete(id);

    if (!result) {
      return NextResponse.json(
        { success: false, message: "Subscriber not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Subscriber deleted",
    });
  } catch (error: any) {
    console.error("Failed to delete subscriber", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete subscriber" },
      { status: 500 }
    );
  }
}
