import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
// Import models
import User from "../models/user.model.js";
import Bundle from "../models/bundle.model.js";
import Transaction from "../models/transaction.model.js";
import Commission from "../models/commission.model.js";
import Payout from "../models/payout.model.js";
import ResellerBundlePrice from "../models/resellerBundlePrice.model.js";

const MONGO_URI = "mongodb://mongodb:27017/JBTEST?replicaSet=rs0";
const PASSWORD = "12345678";

// Real bundle data
const bundlesData = [
  {
    Bundle_id: "JB-MTN-2GB",
    name: "MTN 2GB Data Bundle",
    data: "2GB",
    size: "2GB",
    duration: "non-expiry",
    network: "mtn",
    JBCP: 8.45,
    JBSP: 9.5,
    recommendedRange: "11 – 13",
  },
  {
    Bundle_id: "JB-MTN-5GB",
    name: "MTN 5GB Data Bundle",
    data: "5GB",
    size: "5GB",
    duration: "non-expiry",
    network: "mtn",
    JBCP: 19.85,
    JBSP: 22.5,
    recommendedRange: "23 – 25",
  },
  {
    Bundle_id: "JB-MTN-10GB",
    name: "MTN 10GB Data Bundle",
    data: "10GB",
    size: "10GB",
    duration: "non-expiry",
    network: "mtn",
    JBCP: 38.5,
    JBSP: 43.75,
    recommendedRange: "44 – 50",
  },
  {
    Bundle_id: "JB-TELECEL-40GB",
    name: "Telecel 40GB Data Bundle",
    data: "40GB",
    size: "40GB",
    duration: "non-expiry",
    network: "telecel",
    JBCP: 137,
    JBSP: 155,
    recommendedRange: "156 – 175",
  },
  {
    Bundle_id: "JB-TELECEL-20GB",
    name: "Telecel 20GB Data Bundle",
    data: "20GB",
    size: "20GB",
    duration: "non-expiry",
    network: "telecel",
    JBCP: 75,
    JBSP: 85,
    recommendedRange: "86 – 95",
  },
  {
    Bundle_id: "JB-TELECEL-10GB",
    name: "Telecel 10GB Data Bundle",
    data: "10GB",
    size: "10GB",
    duration: "non-expiry",
    network: "telecel",
    JBCP: 42,
    JBSP: 48,
    recommendedRange: "49 – 55",
  },
  {
    Bundle_id: "JB-AT-15GB",
    name: "Choprice Once More",
    data: "15GB",
    size: "15GB",
    duration: "non-expiry",
    network: "at",
    JBCP: 100,
    JBSP: 110,
    recommendedRange: "110 – 115",
  },
  {
    Bundle_id: "JB-AT-5GB",
    name: "AirtelTigo 5GB Data Bundle",
    data: "5GB",
    size: "5GB",
    duration: "non-expiry",
    network: "at",
    JBCP: 35,
    JBSP: 40,
    recommendedRange: "41 – 45",
  },
  {
    Bundle_id: "JB-AT-8GB",
    name: "AirtelTigo 8GB Data Bundle",
    data: "8GB",
    size: "8GB",
    duration: "non-expiry",
    network: "at",
    JBCP: 55,
    JBSP: 63,
    recommendedRange: "64 – 72",
  },
  {
    Bundle_id: "JB-MTN-1GB",
    name: "MTN 1GB Data Bundle",
    data: "1GB",
    size: "1GB",
    duration: "non-expiry",
    network: "mtn",
    JBCP: 4.5,
    JBSP: 5.25,
    recommendedRange: "6 – 8",
  },
];
 
// Generate realistic Ghana phone numbers
function generatePhoneNumber() {
  const operators = ["024", "050", "055", "059", "026", "054"];
  const operator = operators[Math.floor(Math.random() * operators.length)];
  const rest = String(Math.floor(Math.random() * 10000000)).padStart(7, "0");
  return operator + rest;
}
 
// Generate reseller code (like DAXO-5MjBiv)
function generateResellerCode() {
  const prefix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const suffix = nanoid(6);
  return `${prefix}-${suffix}`;
}
 
async function seedDatabase() {
  try {
    console.log("🌱 Starting database seed...");
    console.log(`Connecting to: ${MONGO_URI}`);
 
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");
 
    // Clear existing data
    console.log("🗑️  Clearing existing data...");
    await Promise.all([
      User.deleteMany({}),
      Bundle.deleteMany({}),
      Transaction.deleteMany({}),
      Commission.deleteMany({}),
      Payout.deleteMany({}),
      ResellerBundlePrice.deleteMany({}),
    ]);
    console.log("✅ Cleared existing collections");
 
    // 1. Create Bundles
    console.log("📦 Creating bundles...");
    const bundles = await Bundle.insertMany(
      bundlesData.map((bundle) => ({
        Bundle_id: bundle.Bundle_id,
        Data: bundle.data,
        name: bundle.name,
        JBCP: bundle.JBCP,
        JBSP: bundle.JBSP,
        network: bundle.network,
        size: bundle.size,
        Duration: bundle.duration,
        isActive: true,
        recommendedRange: bundle.recommendedRange,
      }))
    );
    console.log(`✅ Created ${bundles.length} bundles`);
 
    // 2. Create Admin Users
    console.log("👤 Creating admin users...");
    const hashedPassword = await bcrypt.hash(PASSWORD, 10);
    const admins = await User.insertMany([
      {
        name: "Admin One",
        phoneNumber: "+233501000001",
        email: "admin1@joydata.com",
        password: hashedPassword,
        isAccountVerified: true,
        isApproved: true,
        status: "approved",
        role: "admin",
        isSystemAccount: true,
        canLogin: true,
      },
      {
        name: "Admin Two",
        phoneNumber: "+233501000002",
        email: "admin2@joydata.com",
        password: hashedPassword,
        isAccountVerified: true,
        isApproved: true,
        status: "approved",
        role: "admin",
        isSystemAccount: true,
        canLogin: true,
      },
    ]);
    console.log(`✅ Created ${admins.length} admin users`);
 
    // 3. Create Regular Users (Resellers)
    console.log("👥 Creating reseller users...");
    const resellerUsers = await User.insertMany(
      Array.from({ length: 10 }, (_, idx) => ({
        name: `Reseller ${idx + 1}`,
        phoneNumber: `+233502000${String(idx + 1).padStart(2, "0")}`,
        email: `reseller${idx + 1}@joydata.com`,
        password: hashedPassword,
        isAccountVerified: true,
        isApproved: true,
        status: "approved",
        role: "user",
        resellerCode: generateResellerCode(),
        commissionRate: 5 + Math.floor(Math.random() * 10), // 5-15%
        totalCommissionEarned: 0,
        totalCommissionPaidOut: 0,
        totalSales: 0,
        isSystemAccount: false,
        canLogin: true,
      }))
    );
    console.log(`✅ Created ${resellerUsers.length} reseller users`);
 
    // 4. Create Transactions and Commissions for each user
    console.log("💳 Creating transactions and commissions...");
    let totalCommissionsCreated = 0;
    let totalTransactionsCreated = 0;
 
    for (let userIdx = 0; userIdx < resellerUsers.length; userIdx++) {
      const user = resellerUsers[userIdx];
      let userCommissionEarned = 0;
 
      // Create 10 transactions per user
      for (let txIdx = 0; txIdx < 10; txIdx++) {
        const bundle = bundles[txIdx % bundles.length];
        const baseCost = bundle.JBCP; // Cost to JoyData
        const customerPrice = baseCost + (Math.random() * 3 + 1); // Customer pays markup
        const jbProfit = customerPrice - baseCost;
        
        const phoneNumber = generatePhoneNumber();
        const timestamp = Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000; // Random past week
        const reference = `JBpay_${timestamp}_${Math.floor(Math.random() * 1000000)}`;
 
        // Create transaction with realistic structure
        const transaction = await Transaction.create({
          email: user.email,
          bundleId: bundle._id,
          bundleIdName: bundle.Bundle_id,
          JBCP: bundle.JBCP,
          bundleName: bundle.name,
          resellerCode: user.resellerCode,
          baseCost: baseCost, // What JoyData pays
          amount: customerPrice, // What customer pays
          JBProfit: jbProfit, // JoyData's profit
          currency: "GHS",
          reference: reference,
          status: "success",
          channel: "mobile_money",
          deliveryStatus: "delivered",
          deliveredAt: new Date(timestamp),
          provider_response: {
            gateway_response: "Approved",
            paid_at: new Date(timestamp).toISOString(),
            ip_address: "154.161.140.236",
          },
          metadata: {
            bundleId: bundle.Bundle_id,
            bundleName: bundle.name,
            bundleData: bundle.size,
            network: bundle.network,
            price: customerPrice,
            phoneNumberReceivingData: phoneNumber,
            resellerCode: user.resellerCode,
            resellerId: user._id.toString(),
            resellerName: user.name,
            resellerCommissionPercentage: user.commissionRate,
            resellerProfit: (customerPrice * user.commissionRate) / 100,
          },
          bossuResponse: {
            order_id: `EXT_${timestamp}_${Math.floor(Math.random() * 10000)}`,
            network: bundle.network.toLowerCase(),
            package_key: bundle.size.toLowerCase(),
            recipient_phone: phoneNumber,
            external_reference: reference,
            price: bundle.JBCP,
            status: "processing",
            isIdempotent: false,
          },
          bossuError: {},
        });
 
        totalTransactionsCreated++;
 
        // Calculate commission (based on customer price and reseller commission rate)
        const commissionAmount = (customerPrice * user.commissionRate) / 100;
        const month = new Date().toISOString().substring(0, 7);
 
        // Create commission
        const commission = await Commission.create({
          reseller: user._id,
          resellerName: user.name,
          transaction: transaction._id,
          bundle: bundle._id,
          amount: commissionAmount,
          percentage: user.commissionRate,
          status: "earned",
          month: month,
        });
 
        userCommissionEarned += commissionAmount;
        totalCommissionsCreated++;
      }
 
      // Update user's total commission earned
      await User.findByIdAndUpdate(user._id, {
        totalCommissionEarned: userCommissionEarned,
        totalSales: 10, // 10 transactions per user
      });
    }
 
    console.log(`✅ Created ${totalTransactionsCreated} transactions`);
    console.log(`✅ Created ${totalCommissionsCreated} commissions`);
 
    // 5. Create Payouts for each reseller (2 payouts per user)
    console.log("💰 Creating payouts...");
    let totalPayoutsCreated = 0;
    const networks = ["MTN", "Vodafone", "AirtelTigo"];
 
    for (let userIdx = 0; userIdx < resellerUsers.length; userIdx++) {
      const user = resellerUsers[userIdx];
      const commissions = await Commission.find({ reseller: user._id });
      const totalCommission = commissions.reduce((sum, c) => sum + c.amount, 0);
 
      // Create 2 payouts per user (split the commissions)
      for (let payoutIdx = 0; payoutIdx < 2; payoutIdx++) {
        const payoutAmount = totalCommission / 2; // Split in half
        const payoutCharge = payoutAmount > 50 ? 2.5 : 1.5;
        const netAmount = payoutAmount - payoutCharge;
 
        const payout = await Payout.create({
          reseller: user._id,
          amount: payoutAmount,
          payoutCharge: payoutCharge,
          netAmount: netAmount,
          network: networks[payoutIdx % 3],
          phoneNumber: user.phoneNumber,
          accountName: user.name,
          status: "pending",
          requestedAt: new Date(Date.now() - payoutIdx * 7 * 24 * 60 * 60 * 1000),
          processedAt: null,
          processedBy: null,
          transactionReference: `JBPAYOUT_${user._id}_${payoutIdx}`,
        });
 
        totalPayoutsCreated++;
      }
 
      // Update user's total payout
      const payoutAmount = (user.totalCommissionEarned / 2) * 0.975;
      await User.findByIdAndUpdate(user._id, {
        totalCommissionPaidOut: payoutAmount,
      });
    }
 
    console.log(`✅ Created ${totalPayoutsCreated} payouts`);
 
    // 6. Create ResellerBundlePrice for each reseller for each bundle
    console.log("💲 Creating reseller bundle prices...");
    let resellerPricesCreated = 0;
 
    for (const user of resellerUsers) {
      for (const bundle of bundles) {
        const basePrice = bundle.JBSP;
        const markup = Math.floor(Math.random() * 30) + 5;
        const customPrice = basePrice + markup;
 
        await ResellerBundlePrice.create({
          resellerId: user._id,
          bundleId: bundle._id,
          customPrice: customPrice,
          basePriceSnapshot: basePrice,
          commission: customPrice - basePrice,
          isActive: true,
        });
 
        resellerPricesCreated++;
      }
    }
 
    console.log(`✅ Created ${resellerPricesCreated} reseller bundle prices`);
 
    // Summary
    console.log("\n========== 🎉 SEED COMPLETE ==========");
    console.log(`✅ Admins: ${admins.length}`);
    console.log(`✅ Resellers: ${resellerUsers.length}`);
    console.log(`✅ Bundles: ${bundles.length}`);
    console.log(`✅ Transactions: ${totalTransactionsCreated}`);
    console.log(`✅ Commissions: ${totalCommissionsCreated}`);
    console.log(`✅ Payouts: ${totalPayoutsCreated}`);
    console.log(`✅ Reseller Bundle Prices: ${resellerPricesCreated}`);
    console.log("\n🔐 All users password: 12345678");
    console.log("📧 Admin 1: admin1@joydata.com");
    console.log("📧 Admin 2: admin2@joydata.com");
    console.log("📧 Resellers: reseller1@joydata.com - reseller10@joydata.com");
    console.log("========================================\n");
 
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ Seed Error:", error);
    process.exit(1);
  }
}
 
seedDatabase();
 