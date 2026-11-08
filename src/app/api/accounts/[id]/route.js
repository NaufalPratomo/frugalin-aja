import dbConnect from "../../../../lib/mongodb";
import Account from "../../../../lib/models/Account";
import Transaction from "../../../../lib/models/Transaction";
import { invalidateSnapshots } from "../../../../lib/assetReport";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/auth";
import { NextResponse } from "next/server";

export async function PUT(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { balance, monthlyInterest } = await req.json();

    if (balance === undefined && monthlyInterest === undefined) {
      return NextResponse.json({ message: "Saldo baru atau bunga wajib diisi" }, { status: 400 });
    }

    const newBalance = balance !== undefined ? Math.round(Number(balance)) : undefined;
    const newInterest = monthlyInterest !== undefined ? Math.round(Number(monthlyInterest)) : undefined;
    if ((newBalance !== undefined && !Number.isFinite(newBalance)) ||
        (newInterest !== undefined && (!Number.isFinite(newInterest) || newInterest < 0))) {
      return NextResponse.json({ message: "Nominal tidak valid" }, { status: 400 });
    }

    await dbConnect();

    const account = await Account.findOne({ _id: id, userId: session.user.id });
    if (!account) {
      return NextResponse.json({ message: "Akun tidak ditemukan" }, { status: 404 });
    }

    if (newInterest !== undefined) {
      await Account.updateOne({ _id: id, userId: session.user.id }, { $set: { monthlyInterest: newInterest } });
    }

    // Koreksi saldo dicatat sebagai transaksi ADJUSTMENT agar histori tetap konsisten
    if (newBalance !== undefined) {
      const diff = newBalance - Math.round(Number(account.balance) || 0);
      if (diff !== 0) {
        const adj = await Transaction.create({
          userId: session.user.id,
          accountId: account._id,
          type: "ADJUSTMENT",
          amount: diff,
          category: "Koreksi Saldo",
          description: "Penyesuaian saldo manual",
          date: new Date()
        });
        try {
          await Account.updateOne({ _id: id, userId: session.user.id }, { $inc: { balance: diff } });
        } catch (err) {
          await Transaction.deleteOne({ _id: adj._id });
          throw err;
        }
        await invalidateSnapshots(session.user.id, adj.date);
      }
    }

    const updated = await Account.findById(id);
    return NextResponse.json(updated, { status: 200 });
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

    const account = await Account.findOne({ _id: id, userId: session.user.id });
    if (!account) {
      return NextResponse.json({ message: "Akun tidak ditemukan" }, { status: 404 });
    }

    // Transfer keluar dari akun ini: kembalikan dana yang sempat masuk ke rekening tujuan
    const outgoing = await Transaction.find({
      accountId: id, userId: session.user.id, type: "TRANSFER", toAccountId: { $exists: true, $ne: null }
    }).lean();
    for (const tx of outgoing) {
      await Account.updateOne(
        { _id: tx.toAccountId, userId: session.user.id },
        { $inc: { balance: -Number(tx.amount) } }
      );
    }

    // Transfer masuk dari rekening lain: dana sudah keluar dari asalnya, jadi transaksinya
    // dipertahankan (tanpa tujuan) agar saldo & histori rekening asal tetap sah.
    await Transaction.updateMany(
      { toAccountId: id, userId: session.user.id, type: "TRANSFER" },
      { $unset: { toAccountId: "" } }
    );

    await Transaction.deleteMany({ accountId: id, userId: session.user.id });
    await Account.deleteOne({ _id: id, userId: session.user.id });
    await invalidateSnapshots(session.user.id);

    return NextResponse.json({ message: "Akun dan seluruh transaksinya berhasil dihapus" }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: "Server Error", error: error.message }, { status: 500 });
  }
}
