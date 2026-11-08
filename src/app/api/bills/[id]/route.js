import dbConnect from "../../../../lib/mongodb";
import Bill from "../../../../lib/models/Bill";
import Account from "../../../../lib/models/Account";
import Transaction from "../../../../lib/models/Transaction";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/auth";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { invalidateSnapshots } from "../../../../lib/assetReport";

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

      const accountExists = await Account.exists({ _id: bill.accountId, userId: session.user.id });
      if (!accountExists) {
        return NextResponse.json({ message: "Rekening pembayaran tidak ditemukan" }, { status: 404 });
      }

      // 1. Klaim tagihan secara atomik agar klik ganda tidak membayar dua kali
      const paidAt = new Date();
      const claimed = await Bill.findOneAndUpdate(
        { _id: id, userId: session.user.id, status: { $ne: "PAID" } },
        { $set: { status: "PAID", lastPaidDate: paidAt } },
        { new: true }
      );
      if (!claimed) {
        return NextResponse.json({ message: "Tagihan sudah dibayar bulan ini" }, { status: 400 });
      }

      // 2. Catat transaksi & kurangi saldo secara atomik; batalkan klaim jika gagal
      let newTransaction;
      try {
        newTransaction = await Transaction.create({
          userId: session.user.id,
          accountId: bill.accountId,
          type: "EXPENSE",
          amount: bill.amount,
          category: bill.category,
          description: `Pembayaran Tagihan: ${bill.name}`,
          date: paidAt
        });
        await Account.updateOne({ _id: bill.accountId, userId: session.user.id }, { $inc: { balance: -bill.amount } });
      } catch (err) {
        if (newTransaction) await Transaction.deleteOne({ _id: newTransaction._id });
        await Bill.updateOne({ _id: id }, { $set: { status: bill.status, lastPaidDate: bill.lastPaidDate } });
        throw err;
      }
      await invalidateSnapshots(session.user.id, paidAt);

      return NextResponse.json({ bill: claimed, transaction: newTransaction }, { status: 200 });
    } else {
      // Update biasa
      if (name) bill.name = name;
      if (amount !== undefined) bill.amount = Math.round(Number(amount));
      if (category) bill.category = category;
      if (dueDate !== undefined) bill.dueDate = Math.min(31, Math.max(1, Math.round(Number(dueDate))));
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
