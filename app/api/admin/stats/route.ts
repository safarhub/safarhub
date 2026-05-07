import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/config/database";
import User from "@/models/User";
import Booking from "@/models/Booking";
import Order from "@/models/Order";

// GET - Admin dashboard stats: users, orders, vendors, earnings(INR)
export async function GET(_req: NextRequest) {
	try {
		await dbConnect();

		// Totals
		const [totalUsers, totalVendors, totalServiceOrders, serviceEarningsAgg, productStatsAgg] = await Promise.all([
			User.countDocuments({ accountType: "user" }),
			User.countDocuments({ accountType: "vendor" }),
			Booking.countDocuments({}),
			Booking.aggregate([
				{
					$match: {
						paymentStatus: "paid",
						currency: "INR",
						status: { $ne: "cancelled" },
					},
				},
				{
					$group: {
						_id: null,
						total: { $sum: "$totalAmount" },
					},
				},
			]),
			Order.aggregate([
				{ $match: { status: "Placed" } },
				{ $unwind: "$items" },
				{ $match: { "items.itemType": "Product", "items.status": { $ne: "Cancelled" } } },
				{
					$lookup: {
						from: "products",
						localField: "items.itemId",
						foreignField: "_id",
						as: "product",
					},
				},
				{
					$unwind: {
						path: "$product",
						preserveNullAndEmptyArrays: true,
					},
				},
				{
					$addFields: {
						isRentalItem: {
							$or: [
								{ $eq: ["$product.listingType", "rent"] },
								{ $gt: [{ $ifNull: ["$items.rentalDays", 0] }, 0] },
							],
						},
						rentalDays: {
							$cond: [
								{ $gt: [{ $ifNull: ["$items.rentalDays", 0] }, 0] },
								"$items.rentalDays",
								1,
							],
						},
						unitPrice: {
							$cond: [
								{
									$or: [
										{ $eq: ["$product.listingType", "rent"] },
										{ $gt: [{ $ifNull: ["$items.rentalDays", 0] }, 0] },
									],
								},
								{
									$ifNull: [
										"$items.variant.price",
										{
											$ifNull: [
												"$product.rentPriceDay",
												{
													$ifNull: ["$product.price", { $ifNull: ["$product.basePrice", 0] }],
												},
											],
										},
									],
								},
								{
									$ifNull: [
										"$items.variant.price",
										{ $ifNull: ["$product.price", { $ifNull: ["$product.basePrice", 0] }] },
									],
								},
							],
						},
					},
				},
				{
					$addFields: {
						lineAmount: {
							$multiply: [
								"$unitPrice",
								{ $cond: [{ $gt: ["$items.quantity", 0] }, "$items.quantity", 1] },
								{ $cond: ["$isRentalItem", "$rentalDays", 1] },
							],
						},
					},
				},
				{
					$group: {
						_id: null,
						count: { $sum: 1 },
						total: { $sum: "$lineAmount" },
					},
				},
			]),
		]);

		const serviceEarningsINR =
			Array.isArray(serviceEarningsAgg) && serviceEarningsAgg.length ? Number(serviceEarningsAgg[0].total || 0) : 0;
		const productOrdersCount =
			Array.isArray(productStatsAgg) && productStatsAgg.length ? Number(productStatsAgg[0].count || 0) : 0;
		const productEarningsINR =
			Array.isArray(productStatsAgg) && productStatsAgg.length ? Number(productStatsAgg[0].total || 0) : 0;

		const totalOrders = totalServiceOrders + productOrdersCount;
		const earningsINR = serviceEarningsINR + productEarningsINR;

		return NextResponse.json({
			success: true,
			totals: {
				users: totalUsers,
				orders: totalOrders,
				vendors: totalVendors,
				earningsINR,
				serviceEarningsINR,
				productEarningsINR,
				serviceOrders: totalServiceOrders,
				productOrders: productOrdersCount,
			},
		});
	} catch (error: any) {
		console.error("Error computing admin stats:", error);
		return NextResponse.json(
			{ success: false, message: error?.message || "Failed to compute stats" },
			{ status: 500 }
		);
	}
}


