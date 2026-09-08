import dbConnect from "../../../lib/mongodb";
import Transaction from "../../../lib/models/Transaction";
import Account from "../../../lib/models/Account";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    const page = searchParams.get("page") ? parseInt(searchParams.get("page")) : null;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")) : 20;

    await dbConnect();
    
    let query = { userId: session.user.id };
    if (month && year) {
      const m = parseInt(month);
      const y = parseInt(year);
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 1);
      query.date = { $gte: start, $lt: end };
    } else if (year) {
      const y = parseInt(year);
      const start = new Date(y, 0, 1);
      const end = new Date(y + 1, 0, 1);
      query.date = { $gte: start, $lt: end };
    }

    let queryBuilder = Transaction.find(query).sort({ date: -1 });
    if (page) {
      queryBuilder = queryBuilder.skip((page - 1) * limit).limit(limit);
    }

    // Mengambil transaksi dan melakukan sorting berdasarkan tanggal terbaru
    const transactions = await queryBuilder;
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

    const transactionAmount = Math.round(Number(amount));
    if (isNaN(transactionAmount) || transactionAmount <= 0) {
      return NextResponse.json({ message: "Nominal transaksi tidak valid" }, { status: 400 });
    }
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