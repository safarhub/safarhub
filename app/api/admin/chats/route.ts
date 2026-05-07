import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/config/database";
import Message from "@/models/Message";
import { auth } from "@/lib/middlewares/auth";

export const GET = auth(async (req: NextRequest) => {
  try {
    await dbConnect();

    const actor = (req as any).user;
    if (actor?.accountType !== "admin") {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const conversations = await Message.aggregate([
      {
        $lookup: {
          from: "users",
          localField: "sender",
          foreignField: "_id",
          as: "senderUser",
        },
      },
      { $unwind: "$senderUser" },
      {
        $lookup: {
          from: "users",
          localField: "receiver",
          foreignField: "_id",
          as: "receiverUser",
        },
      },
      { $unwind: "$receiverUser" },
      {
        $addFields: {
          vendorId: {
            $cond: [
              { $eq: ["$senderUser.accountType", "vendor"] },
              "$sender",
              {
                $cond: [
                  { $eq: ["$receiverUser.accountType", "vendor"] },
                  "$receiver",
                  null,
                ],
              },
            ],
          },
          customerId: {
            $cond: [
              { $eq: ["$senderUser.accountType", "user"] },
              "$sender",
              {
                $cond: [
                  { $eq: ["$receiverUser.accountType", "user"] },
                  "$receiver",
                  null,
                ],
              },
            ],
          },
        },
      },
      {
        $match: {
          vendorId: { $ne: null },
          customerId: { $ne: null },
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: {
            requirementId: "$requirementId",
            vendorId: "$vendorId",
            customerId: "$customerId",
          },
          lastMessage: { $first: "$message" },
          lastKind: { $first: "$kind" },
          lastPriceAmount: { $first: "$priceAmount" },
          lastCreatedAt: { $first: "$createdAt" },
          totalMessages: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "userrequirements",
          localField: "_id.requirementId",
          foreignField: "_id",
          as: "requirement",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id.vendorId",
          foreignField: "_id",
          as: "vendor",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id.customerId",
          foreignField: "_id",
          as: "customer",
        },
      },
      { $unwind: { path: "$requirement", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$vendor", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          requirementId: "$_id.requirementId",
          vendorId: "$_id.vendorId",
          customerId: "$_id.customerId",
          requirementTitle: { $ifNull: ["$requirement.title", "Requirement"] },
          vendorName: { $ifNull: ["$vendor.fullName", "Vendor"] },
          vendorEmail: "$vendor.email",
          customerName: { $ifNull: ["$customer.fullName", "Customer"] },
          customerEmail: "$customer.email",
          lastMessage: 1,
          lastKind: 1,
          lastPriceAmount: 1,
          lastCreatedAt: 1,
          totalMessages: 1,
        },
      },
      { $sort: { lastCreatedAt: -1 } },
    ]);

    return NextResponse.json({ success: true, conversations });
  } catch (error: any) {
    console.error("Admin chats list error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to load conversations" },
      { status: 500 }
    );
  }
});
