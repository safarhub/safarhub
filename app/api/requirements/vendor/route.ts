import { NextResponse } from "next/server";
import dbConnect from "@/lib/config/database";
import UserRequirement from "@/models/Userrequirement";
import User from "@/models/User";
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

    // Get vendor details
    const vendor = await User.findById(user.id);
    if (!vendor || vendor.accountType !== "vendor") {
      return NextResponse.json(
        { success: false, message: "Vendor access required" },
        { status: 403 }
      );
    }

    // Get vendor's service categories
    const vendorServices = vendor.vendorServices || [];
    
    // Map vendor services to requirement categories
    const categoryMap: Record<string, string[]> = {
      "stays": ["stays"],
      "tours": ["tours", "tour"],
      "adventures": ["adventure"],
      "vehicle-rental": ["vehicle-rental"],
      "products": ["market-place"],
    };

    // Find matching categories
    let matchingCategories: string[] = [];
    vendorServices.forEach((service: string) => {
      const mapped = categoryMap[service];
      if (mapped) {
        matchingCategories = [...matchingCategories, ...mapped];
      }
    });

    // If vendor is a seller, add marketplace
    if (vendor.isSeller) {
      matchingCategories.push("market-place");
    }

    // If no services, return empty
    if (matchingCategories.length === 0) {
      return NextResponse.json({
        success: true,
        requirements: [],
      });
    }

    // Find requirements that match vendor's categories
    const requirements = await UserRequirement.find({
      categories: { $in: matchingCategories },
    })
      .sort({ createdAt: -1 })
      .populate("user", "fullName avatar");

    return NextResponse.json({
      success: true,
      requirements,
    });
  } catch (error) {
    console.error("GET /requirements/vendor ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
});
