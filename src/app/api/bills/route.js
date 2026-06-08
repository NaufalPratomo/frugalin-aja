import dbConnect from "../../../lib/mongodb";
import Bill from "../../../lib/models/Bill";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    await dbConnect();
    const bills = await Bill.find({ userId: session.user.id });

    // Cek pergeseran bulan untuk mereset status tagihan berulang
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    let updated = false;

    for (let bill of bills) {
      if (bill.status === "PAID" && bill.lastPaidDate) {
        const lastPaid = new Date(bill.lastPaidDate);
        // Jika bulan/tahun saat ini lebih besar dibanding pembayaran terakhir, reset ke UNPAID
        if (
          currentYear > lastPaid.getFullYear() ||
          (currentYear === lastPaid.getFullYear() && currentMonth > lastPaid.getMonth())
        ) {
          bill.status = "UNPAID";
          await bill.save();
          updated = true;
        }
      }
    }

    const finalBills = updated ? await Bill.find({ userId: session.user.id }) : bills;
    return NextResponse.json(finalBills, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: "Server Error", error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { name, amount, category, dueDate, accountId } = await req.json();
    if (!name || !amount || !category || !dueDate || !accountId) {
      return NextResponse.json({ message: "Field wajib tidak boleh kosong" }, { status: 400 });
    }

    await dbConnect();

    const newBill = await Bill.create({
      userId: session.user.id,
      name,
      amount: Number(amount),
      category,
      dueDate: Number(dueDate),
      accountId: new mongoose.Types.ObjectId(accountId),
      status: "UNPAID"
    });

    return NextResponse.json(newBill, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: "Server Error", error: error.message }, { status: 500 });
  }
}
