import dbConnect from "../../../lib/mongodb";
import Account from "../../../lib/models/Account";
import Transaction from "../../../lib/models/Transaction";
import { invalidateSnapshots } from "../../../lib/assetReport";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";
import { NextResponse } from "next/server";

const ACCOUNT_TYPES = ["BANK", "CASH", "INVESTMENT"];

// Catat bunga bulan ini sekali saja per rekening. Idempotent: kunci unik
// (recurringKey) membuat request paralel hanya satu yang berhasil, dan saldo
// dikurangi secara atomik ($inc) hanya oleh pemenangnya.
async function applyMonthlyInterest(userId, accounts) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  let updated = false;

  for (const account of accounts) {
    if (account.type !== "BANK" || !(account.monthlyInterest > 0)) continue;

    // Transaksi bunga lama (sebelum ada recurringKey) tetap dihormati
    const legacy = await Transaction.exists({
      userId,
      accountId: account._id,
      type: "EXPENSE",
      category: "Bunga Bank Wajib",
      date: { $gte: startOfMonth, $lte: endOfMonth }
    });
    if (legacy) continue;

    try {
      await Transaction.create({
        userId,
        accountId: account._id,
        type: "EXPENSE",
        amount: account.monthlyInterest,
        category: "Bunga Bank Wajib",
        description: "Pemotongan bunga bulanan otomatis oleh sistem",
        date: now,
        recurringKey: `interest:${account._id}:${ym}`
      });
    } catch (err) {
      if (err?.code === 11000) continue; // request lain sudah mencatatnya
      throw err;
    }

    await Account.updateOne({ _id: account._id, userId }, { $inc: { balance: -account.monthlyInterest } });
    updated = true;
  }
  return updated;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    let accounts = await Account.find({ userId: session.user.id });
    if (await applyMonthlyInterest(session.user.id, accounts)) {
      accounts = await Account.find({ userId: session.user.id });
    }

    return NextResponse.json(accounts, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: "Server Error", error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { name, type, balance, monthlyInterest } = await req.json();
    if (!name || !type) {
      return NextResponse.json({ message: "Nama dan Tipe wajib diisi" }, { status: 400 });
    }
    if (!ACCOUNT_TYPES.includes(type)) {
      return NextResponse.json({ message: "Tipe rekening tidak valid" }, { status: 400 });
    }

    await dbConnect();
    const newAccount = await Account.create({
      userId: session.user.id,
      name,
      type,
      balance: Math.round(Number(balance) || 0),
      monthlyInterest: type === 'BANK' ? Math.max(0, Math.round(Number(monthlyInterest) || 0)) : 0
    });
    await invalidateSnapshots(session.user.id);

    return NextResponse.json(newAccount, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: "Server Error", error: error.message }, { status: 500 });
  }
}
