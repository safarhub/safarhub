import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/config/database";
import Product from "@/models/Product";
import mongoose from "mongoose";
import { auth } from "@/lib/middlewares/auth";
import { calculateCommission } from "@/lib/utils/commission";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  
  // Await the params promise to get the actual params
  const { id } = await params;
  
  // Validate product ID
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json(
      { success: false, message: "Invalid product ID" },
      { status: 400 }
    );
  }

  try {
    // Fetch the specific product by ID
    const product = await Product.findById(id);
    
    if (!product) {
      return NextResponse.json(
        { success: false, message: "Product not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, product });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch product" },
      { status: 500 }
    );
  }
}

export const PUT = auth(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  await dbConnect();
  
  // Await the params promise to get the actual params
  const { id } = await params;
  
  // Validate product ID
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json(
      { success: false, message: "Invalid product ID" },
      { status: 400 }
    );
  }

  try {
    const body = await req.json();
    const user = (req as any).user;
    
    // Check if user is authorized to update this product
    const product = await Product.findById(id);
    
    if (!product) {
      return NextResponse.json(
        { success: false, message: "Product not found" },
        { status: 404 }
      );
    }
    
    // Only seller who owns the product or admin can update it
    const isAdmin = user.accountType === "admin";
    const isOwner = user.accountType === "vendor" && user.isSeller && 
                   (product.sellerId?.toString() === (user.id || user._id).toString());
    
    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { success: false, message: "Unauthorized to update this product" },
        { status: 403 }
      );
    }

    const {
      name,
      category,
      description,
      basePrice,
      sellerBasePrice,
      images,
      variants,
      tags,
      isActive,
      stock,
      listingType,
      rentPriceDay,
      sellerRentPriceDay,
      rentalQuantity,
      rentalStartDate,
      rentalEndDate,
    } = body;

    // Validate required fields
    if (!name || !category || !description || !listingType) {
      return NextResponse.json(
        { success: false, message: "Missing required fields" },
        { status: 400 }
      );
    }

    const hasExplicitSellerPrice =
      listingType === "buy" ? sellerBasePrice !== undefined : sellerRentPriceDay !== undefined;
    const normalizedSellerBasePrice = Math.max(Number(sellerBasePrice ?? basePrice) || 0, 0);
    const normalizedSellerRentPriceDay = Math.max(Number(sellerRentPriceDay ?? rentPriceDay) || 0, 0);
    const normalizedListingBasePrice = Math.max(Number(basePrice) || 0, 0);
    const normalizedListingRentPriceDay = Math.max(Number(rentPriceDay) || 0, 0);

    if (
      listingType === "buy" &&
      (hasExplicitSellerPrice ? normalizedSellerBasePrice : normalizedListingBasePrice) <= 0
    ) {
      return NextResponse.json(
        { success: false, message: "Price must be greater than 0" },
        { status: 400 }
      );
    }

    if (listingType === "rent") {
      if ((hasExplicitSellerPrice ? normalizedSellerRentPriceDay : normalizedListingRentPriceDay) <= 0) {
        return NextResponse.json(
          { success: false, message: "Rent price per day is required for rental listings" },
          { status: 400 }
        );
      }

      if (!rentalStartDate || !rentalEndDate) {
        return NextResponse.json(
          { success: false, message: "Rental start and end dates are required for rental listings" },
          { status: 400 }
        );
      }

      if (new Date(rentalEndDate) < new Date(rentalStartDate)) {
        return NextResponse.json(
          { success: false, message: "Rental end date must be after start date" },
          { status: 400 }
        );
      }
    }

    if (!Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { success: false, message: "At least one image is required" },
        { status: 400 }
      );
    }

    const Category = (await import("@/models/Category")).default;
    const categoryDoc = await Category.findOne({ slug: category, isActive: true });

    if (!categoryDoc) {
      return NextResponse.json(
        { success: false, message: "Invalid category" },
        { status: 400 }
      );
    }

    const commission = hasExplicitSellerPrice
      ? listingType === "buy"
        ? calculateCommission("buy", category, normalizedSellerBasePrice)
        : calculateCommission("rent", category, normalizedSellerRentPriceDay)
      : null;

    const effectiveBasePrice =
      listingType === "buy"
        ? commission?.listingPrice ?? normalizedListingBasePrice
        : commission?.listingPrice ?? normalizedListingBasePrice;
    const effectiveRentPriceDay =
      listingType === "rent"
        ? commission?.listingPrice ?? normalizedListingRentPriceDay
        : undefined;

    if (listingType === "rent" && !categoryDoc.requiresVariants) {
      if (rentalQuantity === undefined || Number(rentalQuantity) < 1) {
        return NextResponse.json(
          { success: false, message: "Rental quantity is required for rental listings" },
          { status: 400 }
        );
      }
    }

    // Update product fields
    product.name = name;
    product.category = category;
    product.description = description;
    product.basePrice = effectiveBasePrice;
    product.sellerBasePrice =
      listingType === "buy"
        ? hasExplicitSellerPrice
          ? normalizedSellerBasePrice
          : product.sellerBasePrice ?? effectiveBasePrice
        : undefined;
    product.images = images;
    product.tags = tags || [];
    product.isActive = isActive !== undefined ? isActive : product.isActive;
    product.listingType = listingType;
    product.rentPriceDay = effectiveRentPriceDay;
    product.sellerRentPriceDay =
      listingType === "rent"
        ? hasExplicitSellerPrice
          ? normalizedSellerRentPriceDay
          : product.sellerRentPriceDay ?? effectiveRentPriceDay
        : undefined;
    product.commissionRate = commission?.ratePercent ?? product.commissionRate ?? 0;
    product.commissionAmount = commission?.amount ?? product.commissionAmount ?? 0;
    product.rentalQuantity =
      listingType === "rent" && !categoryDoc.requiresVariants
        ? Math.max(Number(rentalQuantity) || 0, 0)
        : undefined;
    product.rentalStartDate = listingType === "rent" ? new Date(rentalStartDate) : undefined;
    product.rentalEndDate = listingType === "rent" ? new Date(rentalEndDate) : undefined;

    // Handle variants
    let isVariantProduct = (variants && Array.isArray(variants) && variants.length > 0) || (product.variants?.length || 0) > 0;

    if (variants && Array.isArray(variants)) {
      if (categoryDoc && categoryDoc.requiresVariants) {
        if (variants.length === 0) {
          return NextResponse.json(
            { success: false, message: `At least one variant is required for ${categoryDoc.name}` },
            { status: 400 }
          );
        }

        for (const variant of variants) {
          if (!variant.color || !variant.size || variant.stock === undefined) {
            return NextResponse.json(
              { success: false, message: "Each variant must have color, size, and stock" },
              { status: 400 }
            );
          }
        }
        
        product.variants = variants;
        product.stock = undefined;
        product.outOfStock = variants.every((variant: any) => Number(variant.stock) <= 0);
        isVariantProduct = true;
      } else {
        // For non-variant products, set the stock field
        const normalizedStock = Math.max(Number(stock) || 0, 0);
        product.stock = normalizedStock;
        product.outOfStock = normalizedStock <= 0;
        isVariantProduct = false;
      }
    } else if (!isVariantProduct && stock !== undefined) {
      const normalizedStock = listingType === "rent"
        ? Math.max(Number(rentalQuantity) || 0, 0)
        : Math.max(Number(stock) || 0, 0);
      product.stock = normalizedStock;
      product.outOfStock = normalizedStock <= 0;
    }

    if (isVariantProduct && (!variants || !Array.isArray(variants))) {
      product.outOfStock = product.variants?.every((variant: any) => Number(variant.stock) <= 0) ?? product.outOfStock;
      if (listingType === "rent") {
        product.rentalQuantity = undefined;
        product.stock = undefined;
      }
    } else if (!isVariantProduct && listingType === "rent") {
      const normalizedRentalQty = Math.max(Number(rentalQuantity) || 0, 0);
      product.stock = normalizedRentalQty;
      product.outOfStock = normalizedRentalQty <= 0;
    }

    // Save updated product
    const updatedProduct = await product.save();

    return NextResponse.json({ success: true, product: updatedProduct });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to update product" },
      { status: 500 }
    );
  }
});

export const DELETE = auth(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  await dbConnect();
  
  // Await the params promise to get the actual params
  const { id } = await params;
  
  // Validate product ID
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json(
      { success: false, message: "Invalid product ID" },
      { status: 400 }
    );
  }

  try {
    const user = (req as any).user;
    
    // Check if user is authorized to delete this product
    const product = await Product.findById(id);
    
    if (!product) {
      return NextResponse.json(
        { success: false, message: "Product not found" },
        { status: 404 }
      );
    }
    
    // Only seller who owns the product or admin can delete it
    const isAdmin = user.accountType === "admin";
    const isOwner = user.accountType === "vendor" && user.isSeller && 
                   (product.sellerId?.toString() === (user.id || user._id).toString());
    
    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { success: false, message: "Unauthorized to delete this product" },
        { status: 403 }
      );
    }

    // Delete the product
    await Product.findByIdAndDelete(id);

    return NextResponse.json({ success: true, message: "Product deleted successfully" });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to delete product" },
      { status: 500 }
    );
  }
});
