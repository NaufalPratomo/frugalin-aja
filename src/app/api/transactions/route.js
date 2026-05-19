import dbConnect from "../../../lib/mongodb";
import Transaction from "../../../lib/models/Transaction";
import Account from "../../../lib/models/Account";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    await dbConnect();
    // Mengambil transaksi dan melakukan sorting berdasarkan tanggal terbaru
    const transactions = await Transaction.find({ userId: session.user.id }).sort({ date: -1 });
    return NextResponse.json(transactions, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: "Server Error", error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { accountId, type, amount, category, description, date } = await req.json();
    if (!accountId || !type || !amount || !category) {
      return NextResponse.json({ message: "Field wajib tidak boleh kosong" }, { status: 400 });
    }

    await dbConnect();

    // PERBAIKAN LOGIKA: Konversi string accountId menjadi Mongoose ObjectId yang valid
    const targetAccountId = new mongoose.Types.ObjectId(accountId);

    const account = await Account.findById(targetAccountId);
    if (!account) {
      return NextResponse.json({ message: "Akun bank tidak ditemukan" }, { status: 404 });
    }

    const transactionAmount = Number(amount);
    let change = type === "INCOME" ? transactionAmount : -transactionAmount;

    // Simpan data transaksi
    const newTransaction = await Transaction.create({
      userId: session.user.id,
      accountId: targetAccountId,
      type,
      amount: transactionAmount,
      category,
      description,
      date: date || new Date()
    });

    // Jalankan kalkulasi update saldo dompet/bank terkait
    account.balance += change;
    await account.save();

    return NextResponse.json(newTransaction, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: "Server Error", error: error.message }, { status: 500 });
  }
}