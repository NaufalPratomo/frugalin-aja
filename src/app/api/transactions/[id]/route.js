import dbConnect from "../../../../lib/mongodb";
import Transaction from "../../../../lib/models/Transaction";
import { applyEffects, balanceEffects, invalidateSnapshots } from "../../../../lib/assetReport";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/auth";
import { NextResponse } from "next/server";

export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    await dbConnect();

    // Hapus secara atomik: hanya satu request yang berhasil mengklaim transaksi ini,
    // sehingga klik ganda tidak mengembalikan saldo dua kali.
    const transaction = await Transaction.findOneAndDelete({ _id: id, userId: session.user.id });
    if (!transaction) {
      return NextResponse.json({ message: "Transaksi tidak ditemukan" }, { status: 404 });
    }

    // Balikkan efek transaksi terhadap saldo (rekening yang sudah terhapus otomatis dilewati)
    const reversed = balanceEffects(transaction).map((e) => ({ ...e, delta: -e.delta }));
    await applyEffects(reversed, session.user.id);
    await invalidateSnapshots(session.user.id, transaction.date);

    return NextResponse.json({ message: "Transaksi berhasil dihapus" }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: "Server Error", error: error.message }, { status: 500 });
  }
}
