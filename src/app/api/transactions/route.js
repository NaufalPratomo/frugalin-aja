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

    const { accountId, toAccountId, type, amount, category, description, date } = await req.json();
    if (!accountId || !type || !amount || !category) {
      return NextResponse.json({ message: "Field wajib tidak boleh kosong" }, { status: 400 });
    }

    if (type === "TRANSFER") {
      if (!toAccountId) {
        return NextResponse.json({ message: "Rekening tujuan wajib diisi untuk transfer" }, { status: 400 });
      }
      if (accountId === toAccountId) {
        return NextResponse.json({ message: "Rekening asal dan tujuan tidak boleh sama" }, { status: 400 });
      }
    }

    await dbConnect();

    const targetAccountId = new mongoose.Types.ObjectId(accountId);
    const account = await Account.findById(targetAccountId);
    if (!account) {
      return NextResponse.json({ message: "Akun bank asal tidak ditemukan" }, { status: 404 });
    }

    const transactionAmount = Number(amount);
    let newTransaction;

    if (type === "TRANSFER") {
      const destAccountId = new mongoose.Types.ObjectId(toAccountId);
      const destAccount = await Account.findById(destAccountId);
      if (!destAccount) {
        return NextResponse.json({ message: "Akun bank tujuan tidak ditemukan" }, { status: 404 });
      }

      // Simpan data transaksi transfer
      newTransaction = await Transaction.create({
        userId: session.user.id,
        accountId: targetAccountId,
        toAccountId: destAccountId,
        type,
        amount: transactionAmount,
        category,
        description,
        date: date || new Date()
      });

      // Update saldo kedua akun
      account.balance -= transactionAmount;
      destAccount.balance += transactionAmount;

      await account.save();
      await destAccount.save();
    } else {
      let change = type === "INCOME" ? transactionAmount : -transactionAmount;

      // Simpan data transaksi
      newTransaction = await Transaction.create({
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
    }

    return NextResponse.json(newTransaction, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: "Server Error", error: error.message }, { status: 500 });
  }
}