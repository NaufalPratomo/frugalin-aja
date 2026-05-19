import dbConnect from "../../../lib/mongodb";
import Account from "../../../lib/models/Account";
import Transaction from "../../../lib/models/Transaction";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    
    // Dapatkan semua akun milik user
    const accounts = await Account.find({ userId: session.user.id });
    
    // Cek apakah ada akun BANK dengan bunga bulanan wajib > 0
    const bankAccountsWithInterest = accounts.filter(
      acc => acc.type === 'BANK' && acc.monthlyInterest && acc.monthlyInterest > 0
    );

    if (bankAccountsWithInterest.length > 0) {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      let updated = false;

      for (const account of bankAccountsWithInterest) {
        // Cek apakah transaksi "Bunga Bank Wajib" untuk bulan ini sudah tercatat
        const existingTx = await Transaction.findOne({
          userId: session.user.id,
          accountId: account._id,
          type: 'EXPENSE',
          category: 'Bunga Bank Wajib',
          date: { $gte: startOfMonth, $lte: endOfMonth }
        });

        if (!existingTx) {
          // Jika belum ada, otomatis buat transaksi pengeluaran bunga bulanan
          await Transaction.create({
            userId: session.user.id,
            accountId: account._id,
            type: 'EXPENSE',
            amount: account.monthlyInterest,
            category: 'Bunga Bank Wajib',
            description: 'Pemotongan bunga bulanan otomatis oleh sistem',
            date: now
          });

          // Kurangi saldo rekening
          account.balance = account.balance - account.monthlyInterest;
          await account.save();
          updated = true;
        }
      }

      if (updated) {
        // Ambil ulang data akun yang sudah diperbarui saldonya
        const freshAccounts = await Account.find({ userId: session.user.id });
        return NextResponse.json(freshAccounts, { status: 200 });
      }
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

    await dbConnect();
    const newAccount = await Account.create({
      userId: session.user.id,
      name,
      type,
      balance: balance || 0,
      monthlyInterest: type === 'BANK' ? (Number(monthlyInterest) || 0) : 0
    });

    return NextResponse.json(newAccount, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: "Server Error", error: error.message }, { status: 500 });
  }
}