import dbConnect from "../../../../lib/mongodb";
import Bill from "../../../../lib/models/Bill";
import Account from "../../../../lib/models/Account";
import Transaction from "../../../../lib/models/Transaction";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/auth";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

export async function PUT(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const { action, name, amount, category, dueDate, accountId } = body;

    await dbConnect();
    const bill = await Bill.findOne({ _id: id, userId: session.user.id });
    if (!bill) {
      return NextResponse.json({ message: "Tagihan tidak ditemukan" }, { status: 404 });
    }

    if (action === "PAY") {
      if (bill.status === "PAID") {
        return NextResponse.json({ message: "Tagihan sudah dibayar bulan ini" }, { status: 400 });
      }

      const account = await Account.findById(bill.accountId);
      if (!account) {
        return NextResponse.json({ message: "Rekening pembayaran tidak ditemukan" }, { status: 404 });
      }

      // 1. Kurangi saldo rekening
      account.balance -= bill.amount;
      await account.save();

      // 2. Buat transaksi pengeluaran baru
      const newTransaction = await Transaction.create({
        userId: session.user.id,
        accountId: bill.accountId,
        type: "EXPENSE",
        amount: bill.amount,
        category: bill.category,
        description: `Pembayaran Tagihan: ${bill.name}`,
        date: new Date()
      });

      // 3. Update status tagihan
      bill.status = "PAID";
      bill.lastPaidDate = new Date();
      await bill.save();

      return NextResponse.json({ bill, transaction: newTransaction }, { status: 200 });
    } else {
      // Update biasa
      if (name) bill.name = name;
      if (amount) bill.amount = Number(amount);
      if (category) bill.category = category;
      if (dueDate) bill.dueDate = Number(dueDate);
      if (accountId) bill.accountId = new mongoose.Types.ObjectId(accountId);

      await bill.save();
      return NextResponse.json(bill, { status: 200 });
    }
  } catch (error) {
    return NextResponse.json({ message: "Server Error", error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    await dbConnect();
    const deletedBill = await Bill.findOneAndDelete({ _id: id, userId: session.user.id });
    
    if (!deletedBill) {
      return NextResponse.json({ message: "Tagihan tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({ message: "Tagihan berhasil dihapus" }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: "Server Error", error: error.message }, { status: 500 });
  }
}
