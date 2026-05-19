import dbConnect from "../../../../lib/mongodb";
import Account from "../../../../lib/models/Account";
import Transaction from "../../../../lib/models/Transaction";
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

    await dbConnect();
    
    const updateData = {};
    if (balance !== undefined) updateData.balance = Number(balance);
    if (monthlyInterest !== undefined) updateData.monthlyInterest = Number(monthlyInterest);

    // Cari akun dan pastikan milik user yang sedang login
    const account = await Account.findOneAndUpdate(
      { _id: id, userId: session.user.id },
      updateData,
      { new: true } // kembalikan data terbaru setelah di-update
    );

    if (!account) {
      return NextResponse.json({ message: "Akun tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json(account, { status: 200 });
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

    // 1. Hapus seluruh transaksi yang terkait dengan akun ini
    await Transaction.deleteMany({ accountId: id, userId: session.user.id });

    // 2. Hapus akun
    const result = await Account.deleteOne({ _id: id, userId: session.user.id });

    if (result.deletedCount === 0) {
      return NextResponse.json({ message: "Akun tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({ message: "Akun dan seluruh transaksinya berhasil dihapus" }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: "Server Error", error: error.message }, { status: 500 });
  }
}